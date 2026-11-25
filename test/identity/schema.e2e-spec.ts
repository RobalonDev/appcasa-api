import {
  createTestApp,
  type TestApp,
  uniqueEmail,
} from '../support/test-app.js';

// Invariants protected by the database itself (plan 001, data model).
describe('Identity schema (e2e)', () => {
  let t: TestApp;
  const now = new Date('2026-01-01T00:00:00.000Z');

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  function newUser(email: string) {
    return t.prisma.user.create({
      data: {
        email,
        displayName: 'Ana',
        passwordHash: '$argon2id$placeholder',
        createdAt: now,
      },
    });
  }

  function newCode(
    email: string,
    status: 'PENDING' | 'ACTIVE' | 'INVALIDATED',
  ) {
    return t.prisma.verificationCode.create({
      data: { email, codeHmac: 'hmac', status, createdAt: now },
    });
  }

  it('RF-40: the database rejects a second account for the same email', async () => {
    const email = uniqueEmail();
    await newUser(email);

    await expect(newUser(email)).rejects.toMatchObject({ code: 'P2002' });
    await expect(t.prisma.user.count({ where: { email } })).resolves.toBe(1);
  });

  it('generates UUIDv7 ids', async () => {
    const user = await newUser(uniqueEmail());
    expect(user.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('RF-11: allows at most one ACTIVE verification code per email', async () => {
    const email = uniqueEmail();
    await newCode(email, 'ACTIVE');

    await expect(newCode(email, 'ACTIVE')).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('RF-11: allows any number of PENDING and INVALIDATED codes next to the ACTIVE one', async () => {
    const email = uniqueEmail();
    await newCode(email, 'ACTIVE');
    await newCode(email, 'PENDING');
    await newCode(email, 'PENDING');
    await newCode(email, 'INVALIDATED');
    await newCode(email, 'INVALIDATED');

    await expect(
      t.prisma.verificationCode.count({ where: { email } }),
    ).resolves.toBe(5);
  });
});
