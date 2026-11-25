import request from 'supertest';
import {
  createIdentityTestApp,
  type IdentityTestApp,
  lastCodeSentTo,
} from '../support/identity.js';
import { uniqueEmail } from '../support/test-app.js';

const MINUTE = 60_000;

describe('Request registration (e2e)', () => {
  let t: IdentityTestApp;

  beforeAll(async () => {
    t = await createIdentityTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  const requestRegistration = (email: unknown) =>
    request(t.app.getHttpServer())
      .post('/auth/registration-requests')
      .send({ email });

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

  it('RF-1: emails a verification code to an address without an account, creating no account', async () => {
    const email = uniqueEmail();

    const response = await requestRegistration(email).expect(202);
    expect(response.text).toBe('');
    await t.drainEmails();

    expect(lastCodeSentTo(t.mail, email)).toMatch(/^\d{6}$/);
    await expect(t.prisma.user.count({ where: { email } })).resolves.toBe(0);
    const code = await t.prisma.verificationCode.findFirstOrThrow({
      where: { email },
    });
    expect(code.status).toBe('ACTIVE');
    expect(code.issuedAt).toEqual(t.clock.now());
  });

  it('RF-26: normalises the email before using it', async () => {
    const email = uniqueEmail();
    await requestRegistration(`  ${email.toUpperCase()} `).expect(202);
    await t.drainEmails();

    expect(t.mail.sentTo(email)).toHaveLength(1);
  });

  it('RF-6: answers exactly the same whether or not the email has an account', async () => {
    const withAccount = uniqueEmail();
    await createAccount(withAccount);

    const a = await requestRegistration(uniqueEmail());
    const b = await requestRegistration(withAccount);
    await t.drainEmails();

    const comparable = (r: request.Response) => {
      const { date: _date, ...headers } = r.headers;
      return { status: r.status, body: r.text, headers };
    };
    expect(comparable(b)).toEqual(comparable(a));
  });

  it('RF-7: sends the account owner a registration-attempt notice instead of a code', async () => {
    const email = uniqueEmail();
    await createAccount(email);

    await requestRegistration(email).expect(202);
    await t.drainEmails();

    const [notice] = t.mail.sentTo(email);
    expect(notice?.subject).toMatch(/intento de registro/i);
    expect(notice?.text).not.toMatch(/\b\d{6}\b/);
    await expect(
      t.prisma.verificationCode.count({ where: { email } }),
    ).resolves.toBe(0);
  });

  it('RF-11: a new code invalidates the previous one only once it is issued', async () => {
    const email = uniqueEmail();
    await requestRegistration(email).expect(202);
    await t.drainEmails();
    const first = await t.prisma.verificationCode.findFirstOrThrow({
      where: { email },
    });

    // A minute later (outside the RF-12 limit), a second request whose email is held.
    t.clock.advance(MINUTE + 1_000);
    const release = t.mail.holdNext();
    await requestRegistration(email).expect(202);

    // While the new code is only reserved, the previous one is still the active one.
    await expect
      .poll(() => t.prisma.verificationCode.count({ where: { email } }))
      .toBe(2);
    await expect(
      t.prisma.verificationCode.findUniqueOrThrow({ where: { id: first.id } }),
    ).resolves.toMatchObject({ status: 'ACTIVE' });
    await expect(
      t.prisma.verificationCode.findFirstOrThrow({
        where: { email, NOT: { id: first.id } },
      }),
    ).resolves.toMatchObject({ status: 'PENDING', issuedAt: null });

    release();
    await t.drainEmails();

    const codes = await t.prisma.verificationCode.findMany({
      where: { email },
      orderBy: { createdAt: 'asc' },
    });
    expect(codes.map((c) => c.status)).toEqual(['INVALIDATED', 'ACTIVE']);
  });

  describe('RF-35: rejects an invalid email', () => {
    it.each([
      ['malformed', 'not-an-email'],
      ['too long', `${'a'.repeat(243)}@example.com`],
      ['missing', undefined],
    ])('%s', async (_case, email) => {
      const response = await requestRegistration(email)
        .expect(400)
        .expect('Content-Type', /application\/problem\+json/);

      expect(response.body).toMatchObject({
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'email', code: 'INVALID_EMAIL' }],
      });
    });

    it('sends nothing for an invalid email', async () => {
      const before = t.mail.sent.length;
      await requestRegistration('not-an-email').expect(400);
      await t.drainEmails();
      expect(t.mail.sent).toHaveLength(before);
    });
  });
});
