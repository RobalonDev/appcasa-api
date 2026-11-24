import { Injectable } from '@nestjs/common';
import { Clock } from '../clock/clock.js';
import { lockKey } from '../database/lock-key.js';
import { PrismaService } from '../database/prisma.service.js';
import { MailSender, type MailMessage } from '../mail/mail-sender.js';
import {
  registrationAttemptEmail,
  verificationCodeEmail,
} from './auth-emails.js';
import { TokensService } from './crypto/tokens.service.js';
import { generateVerificationCode } from './domain/verification-code.js';
import { EMAIL_LOCK } from './email-lock.js';

interface Reservation {
  sendId: string;
  /** Reserved verification code, or null when the email is the RF-7 notice. */
  codeId: string | null;
  message: MailMessage;
}

/**
 * Background work behind «request registration» (ADR-0009, ADR-0013):
 * reserve the send under the email lock, send without holding a connection,
 * then confirm under the lock again.
 */
@Injectable()
export class RegistrationEmailJob {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailSender,
    private readonly clock: Clock,
    private readonly tokens: TokensService,
  ) {}

  async run(email: string): Promise<void> {
    const reservation = await this.reserve(email);
    if (!reservation) {
      return;
    }
    const outcome = await this.mail.send(reservation.message);
    if (outcome === 'accepted') {
      await this.confirm(email, reservation);
    }
  }

  /** Step 1: decide what to send and reserve it (RF-1, RF-7). */
  private reserve(email: string): Promise<Reservation | null> {
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, EMAIL_LOCK, email);
      const now = this.clock.now();

      const hasAccount = (await tx.user.count({ where: { email } })) > 0;
      let codeId: string | null = null;
      let message: MailMessage;
      if (hasAccount) {
        message = registrationAttemptEmail(email);
      } else {
        const code = generateVerificationCode();
        const reserved = await tx.verificationCode.create({
          data: {
            email,
            codeHmac: this.tokens.hmacVerificationCode(email, code),
            status: 'PENDING',
            createdAt: now,
          },
        });
        codeId = reserved.id;
        message = verificationCodeEmail(email, code);
      }

      const send = await tx.authEmailSend.create({
        data: {
          email,
          kind: hasAccount ? 'REGISTRATION_NOTICE' : 'VERIFICATION_CODE',
          status: 'PENDING',
          createdAt: now,
        },
      });
      return { sendId: send.id, codeId, message };
    });
  }

  /**
   * Step 3, the mail service accepted it: the send counts as done, and the code is
   * issued now, invalidating the previous one (RF-11). If an account appeared
   * meanwhile, the code is useless and is invalidated instead.
   */
  private async confirm(
    email: string,
    reservation: Reservation,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, EMAIL_LOCK, email);
      const now = this.clock.now();

      await tx.authEmailSend.update({
        where: { id: reservation.sendId },
        data: { status: 'SENT' },
      });
      if (reservation.codeId === null) {
        return;
      }

      const hasAccount = (await tx.user.count({ where: { email } })) > 0;
      if (hasAccount) {
        await tx.verificationCode.update({
          where: { id: reservation.codeId },
          data: { status: 'INVALIDATED' },
        });
        return;
      }
      await tx.verificationCode.updateMany({
        where: { email, status: 'ACTIVE' },
        data: { status: 'INVALIDATED' },
      });
      await tx.verificationCode.update({
        where: { id: reservation.codeId },
        data: { status: 'ACTIVE', issuedAt: now },
      });
    });
  }
}
