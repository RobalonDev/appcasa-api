import request from 'supertest';
import {
  createIdentityTestApp,
  type IdentityTestApp,
} from '../support/identity.js';
import { uniqueEmail } from '../support/test-app.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

describe('Request registration: limits and failures (e2e)', () => {
  let t: IdentityTestApp;

  beforeAll(async () => {
    t = await createIdentityTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  /** Requests registration and waits until its background work is done. */
  async function requestRegistration(email: string) {
    const response = await request(t.app.getHttpServer())
      .post('/auth/registration-requests')
      .send({ email })
      .expect(202);
    await t.drainEmails();
    return response;
  }

  async function createAccount(email: string) {
    await t.prisma.user.create({
      data: {
        email,
        displayName: 'Ana',
        passwordHash: '$argon2id$placeholder',
        createdAt: t.clock.now(),
      },
    });
  }

  const codes = (email: string) =>
    t.prisma.verificationCode.findMany({
      where: { email },
      orderBy: { createdAt: 'asc' },
    });

  describe('RF-12: at most 1 authentication email per minute and 5 per hour', () => {
    it('does not send a second email within the same minute, and answers the same', async () => {
      const email = uniqueEmail();
      const first = await requestRegistration(email);
      t.clock.advance(59 * SECOND);
      const second = await requestRegistration(email);

      expect(t.mail.sentTo(email)).toHaveLength(1);
      expect(second.status).toBe(first.status);
      expect(second.text).toBe(first.text);
    });

    it('sends again once the minute has passed', async () => {
      const email = uniqueEmail();
      await requestRegistration(email);
      t.clock.advance(MINUTE + SECOND);
      await requestRegistration(email);

      expect(t.mail.sentTo(email)).toHaveLength(2);
    });

    it('does not send a sixth email within the hour, and sends again when the oldest leaves it', async () => {
      const email = uniqueEmail();
      const start = t.clock.now().getTime();
      for (let i = 0; i < 6; i++) {
        await requestRegistration(email);
        t.clock.advance(MINUTE + SECOND);
      }
      expect(t.mail.sentTo(email)).toHaveLength(5);

      // One hour after the first send, only four remain in the last hour.
      t.clock.set(new Date(start + HOUR + SECOND));
      await requestRegistration(email);
      expect(t.mail.sentTo(email)).toHaveLength(6);
    });

    it('counts registration notices (RF-7) and codes against the same limit (spec D2)', async () => {
      const email = uniqueEmail();
      await requestRegistration(email); // a code: no account yet
      await createAccount(email);
      t.clock.advance(30 * SECOND);
      await requestRegistration(email); // would be a notice

      expect(t.mail.sentTo(email)).toHaveLength(1);
    });

    it('counts an email still in flight (spec D19)', async () => {
      const email = uniqueEmail();
      const release = t.mail.holdNext();
      await request(t.app.getHttpServer())
        .post('/auth/registration-requests')
        .send({ email })
        .expect(202);
      await expect
        .poll(() => t.prisma.authEmailSend.count({ where: { email } }))
        .toBe(1);

      await request(t.app.getHttpServer())
        .post('/auth/registration-requests')
        .send({ email })
        .expect(202);
      release();
      await t.drainEmails();

      expect(t.mail.sentTo(email)).toHaveLength(1);
    });

    it('counts an email with an uncertain outcome, whose code is never issued (spec D19)', async () => {
      const email = uniqueEmail();
      t.mail.uncertainNext();
      await requestRegistration(email);
      expect((await codes(email)).map((c) => c.status)).toEqual(['PENDING']);

      t.clock.advance(30 * SECOND);
      await requestRegistration(email);
      expect(t.mail.sentTo(email)).toHaveLength(0);

      t.clock.advance(31 * SECOND);
      await requestRegistration(email);
      expect(t.mail.sentTo(email)).toHaveLength(1);
    });
  });

  it('RF-32: when the limit stops a code, no new code is issued and the previous one stays valid', async () => {
    const email = uniqueEmail();
    await requestRegistration(email);
    t.clock.advance(10 * SECOND);
    await requestRegistration(email);

    expect((await codes(email)).map((c) => c.status)).toEqual(['ACTIVE']);
  });

  describe('RF-38: a failed send', () => {
    it('answers the same, issues no code and keeps the previous one valid', async () => {
      const email = uniqueEmail();
      await requestRegistration(email);
      const [previous] = await codes(email);

      t.clock.advance(MINUTE + SECOND);
      t.mail.failNext();
      const response = await requestRegistration(email);

      expect(response.status).toBe(202);
      expect(await codes(email)).toEqual([previous]);
    });

    it('does not count for the RF-12 limit', async () => {
      const email = uniqueEmail();
      t.mail.failNext();
      await requestRegistration(email);
      t.clock.advance(10 * SECOND);
      await requestRegistration(email);

      expect(t.mail.sentTo(email)).toHaveLength(1);
      await expect(
        t.prisma.authEmailSend.count({ where: { email } }),
      ).resolves.toBe(1);
    });
  });

  it('RF-42: while the email is locked by RF-15, nothing is sent, the quota is untouched and the previous code survives', async () => {
    const email = uniqueEmail();
    await requestRegistration(email);
    const [previous] = await codes(email);
    // RF-15 lockout: 10 failed verifications within 24 h, the last one just now.
    const now = t.clock.now().getTime();
    await t.prisma.verificationFailure.createMany({
      data: Array.from({ length: 10 }, (_, i) => ({
        email,
        failedAt: new Date(now - (9 - i) * MINUTE),
      })),
    });

    t.clock.advance(MINUTE + SECOND);
    await requestRegistration(email);

    expect(t.mail.sentTo(email)).toHaveLength(1);
    expect(await codes(email)).toEqual([previous]);
    await expect(
      t.prisma.authEmailSend.count({ where: { email } }),
    ).resolves.toBe(1);
  });
});
