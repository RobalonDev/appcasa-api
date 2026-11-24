export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Result of handing a message to the mail service (ADR-0013):
 * - `accepted`: the service accepted it (an «envío realizado» in spec 001);
 * - `failed`: it definitely did not leave, so it does not count for any limit (RF-38);
 * - `uncertain`: we cannot know (timeout, broken connection), so it still counts (spec D19).
 */
export type SendOutcome = 'accepted' | 'failed' | 'uncertain';

/**
 * Port for sending email (ADR-0009). Abstract class rather than interface: it doubles
 * as the DI token. Never throws for a delivery problem: it reports the outcome.
 */
export abstract class MailSender {
  abstract send(message: MailMessage): Promise<SendOutcome>;
}
