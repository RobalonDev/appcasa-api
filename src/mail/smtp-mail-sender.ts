import { Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';
import {
  type MailMessage,
  MailSender,
  type SendOutcome,
} from './mail-sender.js';

/** Errors raised before any message data reaches the server: nothing left. */
const FAILED_BEFORE_SENDING = new Set([
  'ECONNECTION',
  'EDNS',
  'EAUTH',
  'ETLS',
  'EENVELOPE',
]);

/**
 * Maps a nodemailer rejection to a send outcome (ADR-0013).
 * - A server reply (any `responseCode`) means the server refused the message.
 * - Errors raised before sending, or a TCP connection that never opened
 *   (`syscall: 'connect'`, e.g. ECONNREFUSED), mean nothing left.
 * - Anything else is uncertain: the message may have been accepted. That includes
 *   every timeout and socket error, because nodemailer tags them with command "CONN"
 *   in any phase, even after DATA.
 */
export function classifySmtpError(
  error: unknown,
): Exclude<SendOutcome, 'accepted'> {
  if (typeof error !== 'object' || error === null) {
    return 'uncertain';
  }
  if ('responseCode' in error && typeof error.responseCode === 'number') {
    return 'failed';
  }
  if ('syscall' in error && error.syscall === 'connect') {
    return 'failed';
  }
  if (
    'code' in error &&
    typeof error.code === 'string' &&
    FAILED_BEFORE_SENDING.has(error.code)
  ) {
    return 'failed';
  }
  return 'uncertain';
}

/**
 * Sends through any SMTP server (ADR-0009): Mailpit locally, the provider chosen in
 * phase 6 in production. No retries: a failure is a send that did not happen (RF-38).
 */
export class SmtpMailSender extends MailSender {
  private readonly logger = new Logger(SmtpMailSender.name);
  private readonly transporter: Transporter;

  constructor(smtpUrl: string, from: string) {
    super();
    this.transporter = createTransport(
      {
        url: smtpUrl,
        // Bounded waits, so a slow server turns into a send outcome quickly.
        connectionTimeout: 5_000,
        greetingTimeout: 5_000,
        socketTimeout: 10_000,
      },
      { from },
    );
  }

  async send(message: MailMessage): Promise<SendOutcome> {
    try {
      await this.transporter.sendMail(message);
      return 'accepted';
    } catch (error) {
      const outcome = classifySmtpError(error);
      // Never log the message body: it may contain a verification code.
      this.logger.warn(
        `Email not accepted (${outcome}): ${error instanceof Error ? error.message : String(error)}`,
      );
      return outcome;
    }
  }
}
