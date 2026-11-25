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

describe('Complete registration: account and session (e2e)', () => {
  let t: IdentityTestApp;

  beforeAll(async () => {
    t = await createIdentityTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function startRegistration(email: string): Promise<string> {
    await request(t.app.getHttpServer())
      .post('/auth/registration-requests')
      .send({ email })
      .expect(202);
    await t.drainEmails();
    return lastCodeSentTo(t.mail, email.trim().toLowerCase());
  }

  const complete = (body: object) =>
    request(t.app.getHttpServer()).post('/auth/registrations').send(body);

  it('RF-4: creates the account with the normalised email, the display name and the password', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);

    await complete({
      email,
      code,
      displayName: '  Ana García ',
      password: PASSWORD,
    }).expect(201);

    const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.displayName).toBe('Ana García');
    expect(user.passwordHash).not.toContain(PASSWORD);
    await expect(
      t.app.get(PasswordHasher).verify(user.passwordHash, PASSWORD),
    ).resolves.toBe(true);
  });

  it('RF-5: starts a session: the response carries tokens and the access token works', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);

    const response = await complete({
      email,
      code,
      displayName: 'Ana',
      password: PASSWORD,
    }).expect(201);

    expect(response.body).toEqual({
      accessToken: expect.any(String),
      tokenType: 'Bearer',
      expiresIn: 300,
      refreshToken: expect.any(String),
    });
    const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
    const me = await request(t.app.getHttpServer())
      .get('/__test/session')
      .set('Authorization', `Bearer ${response.body.accessToken}`)
      .expect(200);
    expect(me.body.userId).toBe(user.id);
    await expect(
      t.prisma.session.count({ where: { userId: user.id, endedAt: null } }),
    ).resolves.toBe(1);
  });

  it('RF-26: the same email in any case or with surrounding spaces, in both steps', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(`  ${email.toUpperCase()} `);

    await complete({
      email: `\t${email.replace('user', 'USER')}`,
      code,
      displayName: 'Ana',
      password: PASSWORD,
    }).expect(201);

    await expect(t.prisma.user.count({ where: { email } })).resolves.toBe(1);
  });

  it('RF-29: once the account exists, no verification code of that email works any more', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);

    await complete({
      email,
      code,
      displayName: 'Ana',
      password: PASSWORD,
    }).expect(201);

    await expect(
      t.prisma.verificationCode.count({ where: { email, status: 'ACTIVE' } }),
    ).resolves.toBe(0);
    const again = await complete({
      email,
      code,
      displayName: 'Ana',
      password: PASSWORD,
    });
    expect(again.body.code).toBe('INVALID_VERIFICATION_CODE');
  });

  it('RF-30: simultaneous completions with the right code create one account; the rest get the generic error', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        complete({ email, code, displayName: 'Ana', password: PASSWORD }),
      ),
    );

    expect(responses.filter((r) => r.status === 201)).toHaveLength(1);
    for (const r of responses.filter((r) => r.status !== 201)) {
      expect(r.status).toBe(400);
      expect(r.body.code).toBe('INVALID_VERIFICATION_CODE');
    }
    await expect(t.prisma.user.count({ where: { email } })).resolves.toBe(1);
  });

  it('D20: a sign-in lockout (RF-22) does not stop the registration: account and session are created', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);
    const now = t.clock.now().getTime();
    await t.prisma.loginAttempt.createMany({
      data: Array.from({ length: 5 }, (_, i) => ({
        email,
        at: new Date(now - (4 - i) * MINUTE),
        outcome: 'FAILURE' as const,
      })),
    });

    const response = await complete({
      email,
      code,
      displayName: 'Ana',
      password: PASSWORD,
    }).expect(201);
    expect(response.body.accessToken).toEqual(expect.any(String));
  });
});
