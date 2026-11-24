import { setTimeout as sleep } from 'node:timers/promises';
import {
  type MailMessage,
  MailSender,
  type SendOutcome,
} from './mail-sender.js';

/**
 * Mail sender for tests (ADR-0009): keeps accepted messages in memory and can simulate
 * failures, uncertain results and a slow server. Swap it in with
 * `overrideProvider(MailSender).useValue(new InMemoryMailSender())`.
 */
export class InMemoryMailSender extends MailSender {
  readonly sent: MailMessage[] = [];
  private readonly outcomes: Exclude<SendOutcome, 'accepted'>[] = [];
  private readonly holds: Promise<void>[] = [];
  private readonly delayMs: number;

  constructor(options: { delayMs?: number } = {}) {
    super();
    this.delayMs = options.delayMs ?? 0;
  }

  async send(message: MailMessage): Promise<SendOutcome> {
    const hold = this.holds.shift();
    if (hold) {
      await hold;
    }
    if (this.delayMs > 0) {
      await sleep(this.delayMs);
    }
    const outcome = this.outcomes.shift() ?? 'accepted';
    if (outcome === 'accepted') {
      this.sent.push(message);
    }
    return outcome;
  }

  /** The next send fails for sure (nothing is recorded). */
  failNext(): void {
    this.outcomes.push('failed');
  }

  /** The next send ends with an unknown result (nothing is recorded). */
  uncertainNext(): void {
    this.outcomes.push('uncertain');
  }

  /**
   * The next send waits until the returned function is called, so a test can look at
   * the state while an email is in flight (ADR-0013).
   */
  holdNext(): () => void {
    let release!: () => void;
    this.holds.push(new Promise<void>((resolve) => (release = resolve)));
    return release;
  }

  sentTo(email: string): MailMessage[] {
    return this.sent.filter((message) => message.to === email);
  }

  clear(): void {
    this.sent.length = 0;
    this.outcomes.length = 0;
    this.holds.length = 0;
  }
}
