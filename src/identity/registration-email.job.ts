import { Injectable, Logger } from '@nestjs/common';
import { Clock } from '../clock/clock.js';
import { lockKey } from '../database/lock-key.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { MailSender, type MailMessage } from '../mail/mail-sender.js';
import {
  registrationAttemptEmail,
  verificationCodeEmail,
} from './auth-emails.js';
import { TokensService } from './crypto/tokens.service.js';
import { lockedUntil, VERIFICATION_LOCKOUT } from './domain/attempt-window.js';
import {
  EMAIL_LIMIT_LOOKBACK_MS,
  mayEmail,
} from './domain/email-send-limit.js';
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
  private readonly logger = new Logger(RegistrationEmailJob.name);

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
    switch (outcome) {
      case 'accepted':
        await this.confirm(email, reservation);
        return;
      case 'failed':
        await this.release(email, reservation);
        return;
      case 'uncertain':
        // Spec D19: the reservation stays PENDING and keeps counting for RF-12;
        // its code is never issued, so it can never be used.
        this.logger.warn('Authentication email with uncertain outcome');
        return;
    }
  }

  /**
   * Step 1: decide what to send and reserve it (RF-1, RF-7), unless the email's codes
   * are locked by RF-15 (RF-42) or one more email would break the RF-12 limit (RF-32).
   * Both checks return before writing anything: no quota is used, no code is touched.
   */
  private reserve(email: string): Promise<Reservation | null> {
    return this.prisma.$transaction(async (tx) => {
      await lockKey(tx, EMAIL_LOCK, email);
      const now = this.clock.now();

      if (await this.isVerificationLocked(tx, email, now)) {
        return null;
      }
      const recentSends = await tx.authEmailSend.findMany({
        where: {
          email,
          createdAt: { gt: new Date(now.getTime() - EMAIL_LIMIT_LOOKBACK_MS) },
        },
        select: { createdAt: true },
      });
      // PENDING and SENT rows both count (spec D19); failed sends were deleted (RF-38).
      if (
        !mayEmail(
          recentSends.map((send) => send.createdAt),
          now,
        )
      ) {
        return null;
      }

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
   * issued now, invalidating the previous one (RF-11). If an account appeared or an
   * RF-15 lockout started meanwhile, the code is not issued (RF-42) and is invalidated.
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
      if (hasAccount || (await this.isVerificationLocked(tx, email, now))) {
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

  /**
   * Step 3, the send definitely failed (RF-38): it does not count for RF-12 and the
   * reserved code is dropped, so the previous code stays the valid one.
   */
  private async release(
    email: string,
    reservation: Reservation,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      await lockKey(tx, EMAIL_LOCK, email);
      await tx.authEmailSend.delete({ where: { id: reservation.sendId } });
      if (reservation.codeId !== null) {
        await tx.verificationCode.delete({ where: { id: reservation.codeId } });
      }
    });
  }

  /** RF-15: whether too many failed verifications currently lock this email's codes. */
  private async isVerificationLocked(
    tx: Prisma.TransactionClient,
    email: string,
    now: Date,
  ): Promise<boolean> {
    const lookback =
      VERIFICATION_LOCKOUT.windowMs + VERIFICATION_LOCKOUT.lockMs;
    const failures = await tx.verificationFailure.findMany({
      where: { email, failedAt: { gt: new Date(now.getTime() - lookback) } },
      select: { failedAt: true },
    });
    const attempts = failures.map((f) => ({
      at: f.failedAt,
      outcome: 'FAILURE' as const,
    }));
    return lockedUntil(attempts, VERIFICATION_LOCKOUT, now) !== null;
  }
}
