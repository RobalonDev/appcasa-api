import request from 'supertest';
import { PasswordHasher } from '../../src/identity/crypto/password-hasher.js';
import { TokensService } from '../../src/identity/crypto/tokens.service.js';
import { InMemoryMailSender } from '../../src/mail/in-memory-mail-sender.js';
import {
  createIdentityTestApp,
  type IdentityTestApp,
} from '../support/identity.js';
import { uniqueEmail } from '../support/test-app.js';

/** RNF-2: 100 requests per case, one email each, means within 50 ms of each other. */
const REQUESTS_PER_CASE = 100;
const MAX_MEAN_DIFFERENCE_MS = 50;
/** Longer than the threshold: if a response waited for the email, the test would fail. */
const MAIL_DELAY_MS = 100;

const MINUTE = 60_000;
const PASSWORD = 'una contraseña larga y segura';
const CODE = '123456';

type Case = (i: number) => request.Test;

describe('RNF-2: response times do not reveal whether an email has an account (e2e)', () => {
  let t: IdentityTestApp;
  let passwordHash: string;

  beforeAll(async () => {
    t = await createIdentityTestApp(
      new InMemoryMailSender({ delayMs: MAIL_DELAY_MS }),
    );
    // Current parameters: verifying it costs the same as the dummy hash.
    passwordHash = await t.app.get(PasswordHasher).hash(PASSWORD);
  }, 30_000);

  afterAll(async () => {
    await t.app.close();
  }, 60_000);

  const server = () => t.app.getHttpServer();
  const emails = (label: string) =>
    Array.from({ length: REQUESTS_PER_CASE }, () => uniqueEmail(label));

  /**
   * Runs the cases round-robin, one request at a time, so background work (queued
   * emails) weighs on every case alike, and returns each case's mean time.
   */
  async function measure(
    cases: Record<string, Case>,
  ): Promise<Record<string, number>> {
    const totals = Object.fromEntries(
      Object.keys(cases).map((name) => [name, 0]),
    );
    // Warm-up, so the first case does not pay for JIT and connection setup.
    for (const call of Object.values(cases)) {
      await call(0);
    }
    for (let i = 1; i <= REQUESTS_PER_CASE; i++) {
      for (const [name, call] of Object.entries(cases)) {
        const start = performance.now();
        const response = await call(i % REQUESTS_PER_CASE);
        totals[name] = (totals[name] ?? 0) + performance.now() - start;
        expect(response.status).toBeLessThan(500);
      }
    }
    return Object.fromEntries(
      Object.entries(totals).map(([name, total]) => [
        name,
        total / REQUESTS_PER_CASE,
      ]),
    );
  }

  function expectIndistinguishable(means: Record<string, number>) {
    const values = Object.values(means);
    const spread = Math.max(...values) - Math.min(...values);
    console.info(
      'RNF-2 means (ms):',
      Object.fromEntries(
        Object.entries(means).map(([k, v]) => [k, Number(v.toFixed(1))]),
      ),
      `spread ${spread.toFixed(1)} ms`,
    );
    expect(spread).toBeLessThanOrEqual(MAX_MEAN_DIFFERENCE_MS);
  }

  async function seedAccounts(list: string[]) {
    await t.prisma.user.createMany({
      data: list.map((email) => ({
        email,
        displayName: 'Ana',
        passwordHash,
        createdAt: t.clock.now(),
      })),
    });
  }

  /** RF-15 lockout: 10 failed verifications in the last minutes. */
  async function seedVerificationLockout(list: string[]) {
    const now = t.clock.now().getTime();
    await t.prisma.verificationFailure.createMany({
      data: list.flatMap((email) =>
        Array.from({ length: 10 }, (_, i) => ({
          email,
          failedAt: new Date(now - (10 - i) * MINUTE),
        })),
      ),
    });
  }

  it('requesting a registration, also when a limit or a lockout applies (RF-12, RF-15, RF-42)', async () => {
    const withoutAccount = emails('req-new');
    const withAccount = emails('req-account');
    const overLimit = emails('req-limit');
    const locked = emails('req-locked');
    await seedAccounts(withAccount);
    // RF-12: an email was sent to each of these a moment ago.
    await t.prisma.authEmailSend.createMany({
      data: overLimit.map((email) => ({
        email,
        kind: 'VERIFICATION_CODE' as const,
        status: 'SENT' as const,
        createdAt: t.clock.now(),
      })),
    });
    await seedVerificationLockout(locked);

    const ask =
      (list: string[]): Case =>
      (i) =>
        request(server())
          .post('/auth/registration-requests')
          .send({ email: list[i] });
    const means = await measure({
      'email without account': ask(withoutAccount),
      'email with account': ask(withAccount),
      'RF-12 limit reached': ask(overLimit),
      'RF-15 lockout (RF-42)': ask(locked),
    });
    await t.drainEmails();

    expectIndistinguishable(means);
  }, 120_000);

  it('completing a registration, also when RF-15 locks the email', async () => {
    const withAccount = emails('done-account');
    const nothingInProgress = emails('done-none');
    const wrongCode = emails('done-wrong');
    const locked = emails('done-locked');
    await seedAccounts(withAccount);
    const tokens = t.app.get(TokensService);
    await t.prisma.verificationCode.createMany({
      data: [...wrongCode, ...locked].map((email) => ({
        email,
        codeHmac: tokens.hmacVerificationCode(email, CODE),
        status: 'ACTIVE' as const,
        createdAt: t.clock.now(),
        issuedAt: t.clock.now(),
      })),
    });
    await seedVerificationLockout(locked);

    const complete =
      (list: string[], code: string): Case =>
      (i) =>
        request(server()).post('/auth/registrations').send({
          email: list[i],
          code,
          displayName: 'Ana',
          password: PASSWORD,
        });
    const means = await measure({
      'email with account': complete(withAccount, CODE),
      'no registration in progress': complete(nothingInProgress, CODE),
      'registration in progress, wrong code': complete(wrongCode, '654321'),
      'RF-15 lockout': complete(locked, '654321'),
    });

    expectIndistinguishable(means);
  }, 120_000);

  it('signing in', async () => {
    const withAccount = emails('in-account');
    const withoutAccount = emails('in-none');
    await seedAccounts(withAccount);

    const signIn =
      (list: string[]): Case =>
      (i) =>
        request(server())
          .post('/auth/sessions')
          .send({ email: list[i], password: 'contraseña equivocada' });
    const means = await measure({
      'email without account': signIn(withoutAccount),
      'email with account, wrong password': signIn(withAccount),
    });

    expectIndistinguishable(means);
  }, 120_000);
});
