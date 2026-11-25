import request from 'supertest';
import { PasswordHasher } from '../../src/identity/crypto/password-hasher.js';
import {
  createIdentityTestApp,
  type IdentityTestApp,
  lastCodeSentTo,
} from '../support/identity.js';
import { uniqueEmail } from '../support/test-app.js';

const MINUTE = 60_000;
const PASSWORD = 'una contraseña larga y segura';
const BURST = 20;

/**
 * RNF-3: the limits of RF-10, RF-12, RF-15 and RF-22 hold exactly under simultaneous
 * requests: never one attempt or one email more than allowed (ADR-0010, ADR-0013).
 */
describe('Limits under concurrency (e2e)', () => {
  let t: IdentityTestApp;

  beforeAll(async () => {
    t = await createIdentityTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  const server = () => t.app.getHttpServer();

  /** Fires `count` requests at the same time and checks none failed on the server. */
  async function burst(count: number, call: () => request.Test) {
    const responses = await Promise.all(Array.from({ length: count }, call));
    expect(responses.filter((r) => r.status >= 500)).toEqual([]);
    return responses;
  }

  async function startRegistration(email: string): Promise<string> {
    await request(server())
      .post('/auth/registration-requests')
      .send({ email })
      .expect(202);
    await t.drainEmails();
    return lastCodeSentTo(t.mail, email);
  }

  const complete = (email: string, code: string) =>
    request(server()).post('/auth/registrations').send({
      email,
      code,
      displayName: 'Ana',
      password: PASSWORD,
    });

  const wrong = (code: string) => (code === '000000' ? '000001' : '000000');

  it('RNF-3 + RF-12: a burst of registration requests sends a single email', async () => {
    const email = uniqueEmail();
    await burst(BURST, () =>
      request(server()).post('/auth/registration-requests').send({ email }),
    );
    await t.drainEmails();

    expect(t.mail.sentTo(email)).toHaveLength(1);
    await expect(
      t.prisma.authEmailSend.count({ where: { email } }),
    ).resolves.toBe(1);
  });

  it('RNF-3 + RF-10: a burst of wrong codes counts exactly 5 failures against the code', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);

    await burst(BURST, () => complete(email, wrong(code)));

    const codes = await t.prisma.verificationCode.findMany({
      where: { email },
    });
    expect(codes).toHaveLength(1);
    expect(codes[0]).toMatchObject({
      status: 'INVALIDATED',
      failedAttempts: 5,
    });
    await expect(
      t.prisma.verificationFailure.count({ where: { email } }),
    ).resolves.toBe(5);
    const late = await complete(email, code);
    expect(late.body.code).toBe('INVALID_VERIFICATION_CODE');
  });

  it('RNF-3 + RF-15: with 9 failures already, a burst adds exactly one and then locks', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);
    const now = t.clock.now().getTime();
    await t.prisma.verificationFailure.createMany({
      data: Array.from({ length: 9 }, (_, i) => ({
        email,
        failedAt: new Date(now - (9 - i) * MINUTE),
      })),
    });

    await burst(BURST, () => complete(email, wrong(code)));

    await expect(
      t.prisma.verificationFailure.count({ where: { email } }),
    ).resolves.toBe(10);
    const correct = await complete(email, code);
    expect(correct.body.code).toBe('INVALID_VERIFICATION_CODE');
  });

  it('RNF-3 + RF-22: a burst of wrong passwords counts exactly 5 failures and then locks', async () => {
    const email = uniqueEmail();
    await t.prisma.user.create({
      data: {
        email,
        displayName: 'Ana',
        passwordHash: await t.app.get(PasswordHasher).hash(PASSWORD),
        createdAt: t.clock.now(),
      },
    });

    const responses = await burst(BURST, () =>
      request(server())
        .post('/auth/sessions')
        .send({ email, password: 'contraseña equivocada' }),
    );

    expect(responses.every((r) => r.status === 401)).toBe(true);
    await expect(
      t.prisma.loginAttempt.count({ where: { email, outcome: 'FAILURE' } }),
    ).resolves.toBe(5);
    await request(server())
      .post('/auth/sessions')
      .send({ email, password: PASSWORD })
      .expect(401);
  });
});
