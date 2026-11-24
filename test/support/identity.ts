import { Clock } from '../../src/clock/clock.js';
import { ControllableClock } from '../../src/clock/controllable-clock.js';
import { AuthEmailJobs } from '../../src/identity/auth-email-jobs.js';
import { InMemoryMailSender } from '../../src/mail/in-memory-mail-sender.js';
import { MailSender } from '../../src/mail/mail-sender.js';
import { createTestApp, type TestApp } from './test-app.js';

export interface IdentityTestApp extends TestApp {
  mail: InMemoryMailSender;
  clock: ControllableClock;
  /** Waits until every queued authentication email has been processed. */
  drainEmails: () => Promise<void>;
}

/**
 * The real app with an in-memory mail sender and a controllable clock (ADR-0012),
 * starting at the current real time so rows look plausible in the dev database.
 */
export async function createIdentityTestApp(
  mail = new InMemoryMailSender(),
): Promise<IdentityTestApp> {
  const clock = new ControllableClock(new Date());
  const t = await createTestApp((builder) =>
    builder
      .overrideProvider(MailSender)
      .useValue(mail)
      .overrideProvider(Clock)
      .useValue(clock),
  );
  const jobs = t.app.get(AuthEmailJobs);
  return { ...t, mail, clock, drainEmails: () => jobs.drain() };
}

/** The 6-digit verification code in the last email sent to `email`. */
export function lastCodeSentTo(
  mail: InMemoryMailSender,
  email: string,
): string {
  const message = mail.sentTo(email).at(-1);
  const code = message?.text.match(/\b(\d{6})\b/)?.[1];
  if (!code) {
    throw new Error(`No verification code was sent to ${email}`);
  }
  return code;
}
