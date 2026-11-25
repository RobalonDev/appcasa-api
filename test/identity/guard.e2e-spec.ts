import { generateKeyPairSync } from 'node:crypto';
import { SignJWT } from 'jose';
import request from 'supertest';
import { SessionsService } from '../../src/identity/sessions.service.js';
import {
  createIdentityTestApp,
  type IdentityTestApp,
} from '../support/identity.js';
import { uniqueEmail } from '../support/test-app.js';

const MINUTE = 60_000;

describe('Global access-token guard (e2e)', () => {
  let t: IdentityTestApp;

  beforeAll(async () => {
    t = await createIdentityTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  /** A user with a fresh session, created the way registration and sign-in will. */
  async function signedInUser() {
    const user = await t.prisma.user.create({
      data: {
        email: uniqueEmail(),
        displayName: 'Ana',
        passwordHash: '$argon2id$placeholder',
        createdAt: t.clock.now(),
      },
    });
    const sessions = t.app.get(SessionsService);
    const tokens = await t.prisma.$transaction((tx) =>
      sessions.createSession(tx, user.id, t.clock.now()),
    );
    return { user, tokens };
  }

  const protectedRoute = (authorization?: string) => {
    const req = request(t.app.getHttpServer()).get('/__test/session');
    return authorization ? req.set('Authorization', authorization) : req;
  };

  async function expectAuthenticationRequired(response: request.Response) {
    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toMatch(
      /application\/problem\+json/,
    );
    expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  }

  it('lets a valid access token through, exposing the user and the session', async () => {
    const { user, tokens } = await signedInUser();
    const response = await protectedRoute(
      `Bearer ${tokens.accessToken}`,
    ).expect(200);

    const session = await t.prisma.session.findFirstOrThrow({
      where: { userId: user.id },
    });
    expect(response.body).toEqual({ userId: user.id, sessionId: session.id });
  });

  it('creates a session with its first refresh token, stored only as a hash', async () => {
    const { user, tokens } = await signedInUser();
    expect(tokens).toMatchObject({ tokenType: 'Bearer', expiresIn: 300 });

    const session = await t.prisma.session.findFirstOrThrow({
      where: { userId: user.id },
      include: { refreshTokens: true },
    });
    expect(session.lastUsedAt).toEqual(session.createdAt);
    expect(session.endedAt).toBeNull();
    expect(session.refreshTokens).toHaveLength(1);
    expect(session.refreshTokens[0]?.tokenHash).not.toBe(tokens.refreshToken);
    expect(session.refreshTokens[0]?.usedAt).toBeNull();
  });

  describe('RF-33: rejects any request without a valid session', () => {
    it('without an Authorization header', async () => {
      await expectAuthenticationRequired(await protectedRoute());
    });

    it('with another scheme or a malformed header', async () => {
      const { tokens } = await signedInUser();
      for (const header of [
        `Basic ${tokens.accessToken}`,
        'Bearer',
        'Bearer ',
        `Bearer  ${tokens.accessToken} extra`,
      ]) {
        await expectAuthenticationRequired(await protectedRoute(header));
      }
    });

    it('with a tampered token', async () => {
      const { tokens } = await signedInUser();
      const [header, payload, signature] = tokens.accessToken.split('.');
      const flipped = `${payload?.slice(0, -2)}${payload?.at(-2) === 'A' ? 'B' : 'A'}${payload?.at(-1)}`;
      await expectAuthenticationRequired(
        await protectedRoute(`Bearer ${header}.${flipped}.${signature}`),
      );
    });

    it('with a token signed with another algorithm or key', async () => {
      const { user } = await signedInUser();
      const hs256 = await new SignJWT({ sid: 'whatever' })
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(user.id)
        .setIssuer('appcasa')
        .setAudience('appcasa')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(new TextEncoder().encode('z'.repeat(32)));
      const otherKey = await new SignJWT({ sid: 'whatever' })
        .setProtectedHeader({ alg: 'EdDSA' })
        .setSubject(user.id)
        .setIssuer('appcasa')
        .setAudience('appcasa')
        .setIssuedAt()
        .setExpirationTime('5m')
        .sign(generateKeyPairSync('ed25519').privateKey);

      await expectAuthenticationRequired(
        await protectedRoute(`Bearer ${hs256}`),
      );
      await expectAuthenticationRequired(
        await protectedRoute(`Bearer ${otherKey}`),
      );
    });

    it('with an expired token: valid just before 5 minutes, rejected at 5 minutes', async () => {
      const { tokens } = await signedInUser();
      t.clock.advance(5 * MINUTE - 1_000);
      await protectedRoute(`Bearer ${tokens.accessToken}`).expect(200);
      t.clock.advance(1_000);
      await expectAuthenticationRequired(
        await protectedRoute(`Bearer ${tokens.accessToken}`),
      );
    });
  });

  describe('RNF-1: deny by default, except the routes marked public', () => {
    it('the health check is public (spec D21)', async () => {
      await request(t.app.getHttpServer()).get('/health').expect(200);
    });

    it('requesting a registration is public', async () => {
      await request(t.app.getHttpServer())
        .post('/auth/registration-requests')
        .send({ email: uniqueEmail() })
        .expect(202);
      await t.drainEmails();
    });

    it('any other route requires a session', async () => {
      await expectAuthenticationRequired(await protectedRoute());
    });
  });
});
