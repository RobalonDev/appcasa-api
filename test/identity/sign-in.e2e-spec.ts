import request from 'supertest';
import { PasswordHasher } from '../../src/identity/crypto/password-hasher.js';
import {
  createIdentityTestApp,
  type IdentityTestApp,
} from '../support/identity.js';
import { uniqueEmail } from '../support/test-app.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const PASSWORD = 'una contraseña larga y segura';

describe('Sign in (e2e)', () => {
  let t: IdentityTestApp;

  beforeAll(async () => {
    t = await createIdentityTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  async function createUser(
    password = PASSWORD,
    hasher = t.app.get(PasswordHasher),
  ) {
    const email = uniqueEmail();
    const user = await t.prisma.user.create({
      data: {
        email,
        displayName: 'Ana',
        passwordHash: await hasher.hash(password),
        createdAt: t.clock.now(),
      },
    });
    return { email, user };
  }

  const signIn = (email: unknown, password: unknown) =>
    request(t.app.getHttpServer())
      .post('/auth/sessions')
      .send({ email, password });

  function expectInvalidCredentials(response: request.Response) {
    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Unauthorized',
      status: 401,
      code: 'INVALID_CREDENTIALS',
    });
  }

  const failures = (email: string) =>
    t.prisma.loginAttempt.count({ where: { email, outcome: 'FAILURE' } });

  describe('RF-17: correct credentials start a new session', () => {
    it('answers the session tokens, and the access token works', async () => {
      const { email, user } = await createUser();
      const response = await signIn(email, PASSWORD).expect(201);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 300,
        refreshToken: expect.any(String),
      });
      const me = await request(t.app.getHttpServer())
        .get('/__test/session')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
      expect(me.body.userId).toBe(user.id);
    });

    it('creates one session per sign-in, even from the same device', async () => {
      const { email, user } = await createUser();
      await signIn(email, PASSWORD).expect(201);
      await signIn(email, PASSWORD).expect(201);
      await expect(
        t.prisma.session.count({ where: { userId: user.id } }),
      ).resolves.toBe(2);
    });
  });

  it('RF-13: the same answer for an unknown email and for a wrong password', async () => {
    const { email } = await createUser();
    const unknown = await signIn(uniqueEmail(), PASSWORD);
    const wrong = await signIn(email, 'otra contraseña distinta');

    expectInvalidCredentials(unknown);
    expectInvalidCredentials(wrong);
    const { date: _a, ...unknownHeaders } = unknown.headers;
    const { date: _b, ...wrongHeaders } = wrong.headers;
    expect(wrongHeaders).toEqual(unknownHeaders);
  });

  it('RF-26: the email is matched regardless of case and surrounding whitespace', async () => {
    const { email } = await createUser();
    await signIn(`\u00a0 ${email.toUpperCase()} `, PASSWORD).expect(201);
  });

  describe('RF-35: an invalid email is rejected as such, and is not a failed attempt', () => {
    it.each([
      ['malformed', 'ana@'],
      ['missing', undefined],
    ])('%s', async (_case, email) => {
      const response = await signIn(email, PASSWORD).expect(400);
      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'email', code: 'INVALID_EMAIL' }],
      });
    });

    it('reports only the email even if the password is missing too', async () => {
      const response = await signIn('ana@', undefined).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'email', code: 'INVALID_EMAIL' },
      ]);
    });

    it('a password that is not text is a malformed request', async () => {
      const response = await signIn(uniqueEmail(), 12345).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'password', code: 'INVALID_FIELD' },
      ]);
    });
  });

  describe('RF-39: canonically equivalent passwords are the same password', () => {
    it('signs in with a password typed in NFD when it was set in NFC', async () => {
      const { email } = await createUser('contraseña segura de casa');
      await signIn(email, 'contrasen\u0303a segura de casa').expect(201);
    });

    it('rejects a compatibility variant (full-width letters)', async () => {
      const { email } = await createUser('password-de-casa');
      expectInvalidCredentials(
        await signIn(
          email,
          '\uff50\uff41\uff53\uff53\uff57\uff4f\uff52\uff44-de-casa',
        ),
      );
    });
  });

  describe('RF-22: 5 failures in 15 min with no success between them lock sign-in for 15 min', () => {
    async function failFiveTimes(email: string) {
      for (let i = 0; i < 5; i++) {
        expectInvalidCredentials(await signIn(email, 'contraseña equivocada'));
      }
    }

    it('rejects even the right password, with the same generic answer', async () => {
      const { email } = await createUser();
      await failFiveTimes(email);
      expectInvalidCredentials(await signIn(email, PASSWORD));
    });

    it('is still locked 1 s before the 15 min end, and free 1 s after', async () => {
      const { email } = await createUser();
      await failFiveTimes(email);
      t.clock.advance(15 * MINUTE - SECOND);
      expectInvalidCredentials(await signIn(email, PASSWORD));
      t.clock.advance(2 * SECOND);
      await signIn(email, PASSWORD).expect(201);
    });

    it('locks an email that has no account too', async () => {
      const email = uniqueEmail();
      await failFiveTimes(email);
      expect(await failures(email)).toBe(5);
    });

    it('a successful sign-in between the failures resets the count', async () => {
      const { email } = await createUser();
      for (let i = 0; i < 4; i++) {
        expectInvalidCredentials(await signIn(email, 'contraseña equivocada'));
      }
      await signIn(email, PASSWORD).expect(201);
      for (let i = 0; i < 4; i++) {
        expectInvalidCredentials(await signIn(email, 'contraseña equivocada'));
      }
      await signIn(email, PASSWORD).expect(201);
    });
  });

  it('RF-31: attempts rejected during the lockout do not count and do not extend it', async () => {
    const { email } = await createUser();
    for (let i = 0; i < 5; i++) {
      expectInvalidCredentials(await signIn(email, 'contraseña equivocada'));
    }
    for (let i = 0; i < 3; i++) {
      t.clock.advance(4 * MINUTE);
      expectInvalidCredentials(await signIn(email, 'contraseña equivocada'));
    }
    expect(await failures(email)).toBe(5);

    t.clock.advance(3 * MINUTE + SECOND); // 15 min + 1 s after the fifth failure
    await signIn(email, PASSWORD).expect(201);
  });

  it('re-hashes a password stored with old argon2 parameters on sign-in (ADR-0008)', async () => {
    const weak = new PasswordHasher({
      memory: 8192,
      passes: 1,
      parallelism: 1,
    });
    const { email } = await createUser(PASSWORD, weak);

    await signIn(email, PASSWORD).expect(201);

    const user = await t.prisma.user.findUniqueOrThrow({ where: { email } });
    expect(user.passwordHash).toMatch(/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
    await signIn(email, PASSWORD).expect(201);
  });
});
