import request from 'supertest';
import {
  createIdentityTestApp,
  type IdentityTestApp,
  lastCodeSentTo,
} from '../support/identity.js';
import { uniqueEmail } from '../support/test-app.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

const PASSWORD = 'una contraseña larga y segura';
const NAME = 'Ana García';

describe('Complete registration: validation and code (e2e)', () => {
  let t: IdentityTestApp;

  beforeAll(async () => {
    t = await createIdentityTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  /** Step 1 of registration; returns the code emailed to `email`. */
  async function startRegistration(email: string): Promise<string> {
    await request(t.app.getHttpServer())
      .post('/auth/registration-requests')
      .send({ email })
      .expect(202);
    await t.drainEmails();
    return lastCodeSentTo(t.mail, email);
  }

  const complete = (body: unknown) =>
    request(t.app.getHttpServer())
      .post('/auth/registrations')
      .send(body as object);

  const valid = (email: string, code: unknown) => ({
    email,
    code,
    displayName: NAME,
    password: PASSWORD,
  });

  /** A wrong code, different from `code`. */
  const wrong = (code: string) => (code === '000000' ? '000001' : '000000');

  async function expectGenericCodeError(response: request.Response) {
    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'INVALID_VERIFICATION_CODE',
    });
  }

  async function activeCode(email: string) {
    return t.prisma.verificationCode.findFirst({
      where: { email, status: 'ACTIVE' },
    });
  }

  async function failureCount(email: string) {
    return t.prisma.verificationFailure.count({ where: { email } });
  }

  describe('RF-37: validates the email first, then name and password, then the code', () => {
    it('reports only the invalid email when everything is invalid', async () => {
      const response = await complete({
        email: 'not-an-email',
        code: 'x',
        displayName: 'A',
        password: 'short',
      }).expect(400);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'email', code: 'INVALID_EMAIL' }],
      });
    });

    it('reports only the invalid email when the password is missing too (plan Q3)', async () => {
      const response = await complete({ email: 'not-an-email' }).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'email', code: 'INVALID_EMAIL' },
      ]);
    });

    it('treats a body that is not an object as if every field were missing', async () => {
      const response = await request(t.app.getHttpServer())
        .post('/auth/registrations')
        .set('Content-Type', 'application/json')
        .send('["ana@example.com"]')
        .expect(400);
      expect(response.body.errors).toEqual([
        { field: 'email', code: 'INVALID_EMAIL' },
      ]);
    });
  });

  describe('RF-35, RF-23, RF-24, RF-27: invalid data', () => {
    it('RF-35: rejects an invalid or missing email', async () => {
      for (const email of ['ana@', undefined]) {
        const response = await complete({
          ...valid('x', '000000'),
          email,
        }).expect(400);
        expect(response.body.errors).toEqual([
          { field: 'email', code: 'INVALID_EMAIL' },
        ]);
      }
    });

    it('RF-27: rejects an invalid or missing display name', async () => {
      for (const displayName of ['A', 'Ana\u200bGarcía', undefined]) {
        const response = await complete({
          ...valid(uniqueEmail(), '000000'),
          displayName,
        }).expect(400);
        expect(response.body.errors).toEqual([
          { field: 'displayName', code: 'INVALID_DISPLAY_NAME' },
        ]);
      }
    });

    it('RF-23: rejects a password that is too short, too long or missing', async () => {
      for (const password of ['a'.repeat(11), 'a'.repeat(129), undefined]) {
        const response = await complete({
          ...valid(uniqueEmail(), '000000'),
          password,
        }).expect(400);
        expect(response.body.errors).toEqual([
          { field: 'password', code: 'INVALID_PASSWORD_LENGTH' },
        ]);
      }
    });

    it('RF-24: rejects a leaked password', async () => {
      const response = await complete({
        ...valid(uniqueEmail(), '000000'),
        password: 'qwerty123456',
      }).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'password', code: 'BREACHED_PASSWORD' },
      ]);
    });

    it('reports name and password problems together', async () => {
      const response = await complete({
        ...valid(uniqueEmail(), '000000'),
        displayName: 'A',
        password: 'short',
      }).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'displayName', code: 'INVALID_DISPLAY_NAME' },
        { field: 'password', code: 'INVALID_PASSWORD_LENGTH' },
      ]);
    });
  });

  it('RF-28: with invalid data the code is not evaluated: it stays valid and nothing counts as failed', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);

    await complete({ ...valid(email, code), password: 'short' }).expect(400);
    await complete({ ...valid(email, wrong(code)), displayName: 'A' }).expect(
      400,
    );

    expect(await activeCode(email)).toMatchObject({ failedAttempts: 0 });
    expect(await failureCount(email)).toBe(0);
    await complete(valid(email, code)).expect(201);
  });

  describe('RF-16: one generic error for every code problem', () => {
    it('a wrong code', async () => {
      const email = uniqueEmail();
      const code = await startRegistration(email);
      await expectGenericCodeError(await complete(valid(email, wrong(code))));
    });

    it.each([
      ['empty', ''],
      ['5 digits', '12345'],
      ['7 digits', '1234567'],
      ['letters', 'abcdef'],
    ])(
      'a malformed code (%s) counts as a wrong code (plan Q3)',
      async (_case, code) => {
        const email = uniqueEmail();
        await startRegistration(email);
        await expectGenericCodeError(await complete(valid(email, code)));
        expect(await failureCount(email)).toBe(1);
      },
    );

    it.each([
      ['missing', undefined],
      ['a number', 123456],
    ])(
      'a code that is not text (%s) does not count as failed (plan Q3)',
      async (_case, code) => {
        const email = uniqueEmail();
        await startRegistration(email);
        await expectGenericCodeError(await complete(valid(email, code)));
        expect(await failureCount(email)).toBe(0);
      },
    );

    it('an email with no registration in progress, which does not count either (spec D16)', async () => {
      const email = uniqueEmail();
      await expectGenericCodeError(await complete(valid(email, '123456')));
      expect(await failureCount(email)).toBe(0);
    });
  });

  describe('RF-9: a code expires 15 minutes after it was issued', () => {
    it('is still accepted at exactly 15 minutes', async () => {
      const email = uniqueEmail();
      const code = await startRegistration(email);
      t.clock.advance(15 * MINUTE);
      await complete(valid(email, code)).expect(201);
    });

    it('is rejected at 15 minutes and 1 second, without counting as failed', async () => {
      const email = uniqueEmail();
      const code = await startRegistration(email);
      t.clock.advance(15 * MINUTE + SECOND);
      await expectGenericCodeError(await complete(valid(email, code)));
      expect(await failureCount(email)).toBe(0);
    });
  });

  describe('RF-10: 5 failed attempts invalidate the code', () => {
    it('still accepts the right code after 4 failures', async () => {
      const email = uniqueEmail();
      const code = await startRegistration(email);
      for (let i = 0; i < 4; i++) {
        await expectGenericCodeError(await complete(valid(email, wrong(code))));
      }
      await complete(valid(email, code)).expect(201);
    });

    it('rejects the right code after 5 failures', async () => {
      const email = uniqueEmail();
      const code = await startRegistration(email);
      for (let i = 0; i < 5; i++) {
        await expectGenericCodeError(await complete(valid(email, wrong(code))));
      }
      expect(await activeCode(email)).toBeNull();
      await expectGenericCodeError(await complete(valid(email, code)));
      expect(await failureCount(email)).toBe(5);
    });
  });

  it('RF-11: once a new code is issued, the previous one no longer works', async () => {
    const email = uniqueEmail();
    const first = await startRegistration(email);
    t.clock.advance(MINUTE + SECOND);
    const second = await startRegistration(email);

    if (first !== second) {
      await expectGenericCodeError(await complete(valid(email, first)));
    }
    await complete(valid(email, second)).expect(201);
  });

  describe('RF-15: 10 failed verifications in 24 h lock the email for 24 h', () => {
    it('rejects even the right code, and issues no code until the 24 h are over', async () => {
      const email = uniqueEmail();
      // 4 + 4 + 2 failures over three codes: no code reaches the RF-10 limit.
      let code = '';
      for (const failures of [4, 4, 2]) {
        code = await startRegistration(email);
        for (let i = 0; i < failures; i++) {
          await expectGenericCodeError(
            await complete(valid(email, wrong(code))),
          );
        }
        t.clock.advance(MINUTE + SECOND);
      }
      expect(await failureCount(email)).toBe(10);
      const tenth = await t.prisma.verificationFailure.findFirstOrThrow({
        where: { email },
        orderBy: { failedAt: 'desc' },
      });

      // The third code is still active, but locked: even the right one is rejected.
      await expectGenericCodeError(await complete(valid(email, code)));
      // Rejections during the lockout do not count (definition of failed verification).
      await expectGenericCodeError(await complete(valid(email, wrong(code))));
      expect(await failureCount(email)).toBe(10);

      // 1 s before the end of the lockout, no new code is issued (RF-42).
      t.clock.set(new Date(tenth.failedAt.getTime() + 24 * HOUR - SECOND));
      const sentBefore = t.mail.sentTo(email).length;
      await request(t.app.getHttpServer())
        .post('/auth/registration-requests')
        .send({ email })
        .expect(202);
      await t.drainEmails();
      expect(t.mail.sentTo(email)).toHaveLength(sentBefore);

      // 1 s after it, a new code is issued and accepted.
      t.clock.set(new Date(tenth.failedAt.getTime() + 24 * HOUR + SECOND));
      const fresh = await startRegistration(email);
      await complete(valid(email, fresh)).expect(201);
    });
  });

  it('RF-41: a valid code for an email that already has an account creates nothing and does not count', async () => {
    const email = uniqueEmail();
    const code = await startRegistration(email);
    await t.prisma.user.create({
      data: {
        email,
        displayName: 'Bea',
        passwordHash: '$argon2id$placeholder',
        createdAt: t.clock.now(),
      },
    });

    await expectGenericCodeError(await complete(valid(email, code)));
    await expectGenericCodeError(await complete(valid(email, wrong(code))));
    expect(await failureCount(email)).toBe(0);
    await expect(t.prisma.user.count({ where: { email } })).resolves.toBe(1);
  });
});
