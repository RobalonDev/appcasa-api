import { createHash } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import request from 'supertest';
import { PasswordHasher } from '../../src/identity/crypto/password-hasher.js';
import {
  createIdentityTestApp,
  type IdentityTestApp,
} from '../support/identity.js';
import { uniqueEmail } from '../support/test-app.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;
const PASSWORD = 'una contraseña larga y segura';

describe('Renew a session (e2e)', () => {
  let t: IdentityTestApp;
  let passwordHash: string;

  beforeAll(async () => {
    t = await createIdentityTestApp();
    passwordHash = await t.app.get(PasswordHasher).hash(PASSWORD);
  });

  afterAll(async () => {
    await t.app.close();
  });

  /** A user signed in through the API; returns the session tokens. */
  async function signedIn(email = uniqueEmail()) {
    if (!(await t.prisma.user.findUnique({ where: { email } }))) {
      await t.prisma.user.create({
        data: {
          email,
          displayName: 'Ana',
          passwordHash,
          createdAt: t.clock.now(),
        },
      });
    }
    const response = await request(t.app.getHttpServer())
      .post('/auth/sessions')
      .send({ email, password: PASSWORD })
      .expect(201);
    return {
      email,
      tokens: response.body as { accessToken: string; refreshToken: string },
    };
  }

  const refresh = (refreshToken: unknown) =>
    request(t.app.getHttpServer())
      .post('/auth/sessions/refresh')
      .send({ refreshToken });

  function expectAuthenticationRequired(response: request.Response) {
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  }

  /** The session a refresh token belongs to (tokens are stored as their SHA-256). */
  async function sessionOf(refreshToken: string) {
    const token = await t.prisma.refreshToken.findUniqueOrThrow({
      where: {
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      },
      include: { session: true },
    });
    return token.session;
  }

  describe('rotation (ADR-0008)', () => {
    it('answers new tokens: a new refresh token and a working access token', async () => {
      const { tokens } = await signedIn();
      t.clock.advance(MINUTE);
      const response = await refresh(tokens.refreshToken).expect(200);

      expect(response.body).toEqual({
        accessToken: expect.any(String),
        tokenType: 'Bearer',
        expiresIn: 300,
        refreshToken: expect.any(String),
      });
      expect(response.body.refreshToken).not.toBe(tokens.refreshToken);
      await request(t.app.getHttpServer())
        .get('/__test/session')
        .set('Authorization', `Bearer ${response.body.accessToken}`)
        .expect(200);
    });

    it('keeps the same session and records the renewal as its last use (RF-20)', async () => {
      const { tokens } = await signedIn();
      const before = await sessionOf(tokens.refreshToken);
      t.clock.advance(MINUTE);
      const response = await refresh(tokens.refreshToken).expect(200);

      const after = await sessionOf(response.body.refreshToken);
      expect(after.id).toBe(before.id);
      expect(after.lastUsedAt).toEqual(t.clock.now());
    });

    it('rejects an unknown token and a malformed request', async () => {
      expectAuthenticationRequired(await refresh('not-a-real-token'));
      const response = await refresh(undefined).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'refreshToken', code: 'INVALID_FIELD' },
      ]);
    });
  });

  describe('RF-20: a session unused for 30 days ends', () => {
    it('still renews 30 days after its last use (within the 5-minute tolerance)', async () => {
      const { tokens } = await signedIn();
      t.clock.advance(30 * DAY);
      await refresh(tokens.refreshToken).expect(200);
    });

    it('does not renew 30 days, 5 minutes and 1 second after its last use', async () => {
      const { tokens } = await signedIn();
      t.clock.advance(30 * DAY + 5 * MINUTE + SECOND);
      expectAuthenticationRequired(await refresh(tokens.refreshToken));
    });

    it('counts from the last renewal, not from the creation', async () => {
      const { tokens } = await signedIn();
      t.clock.advance(20 * DAY);
      const renewed = await refresh(tokens.refreshToken).expect(200);
      t.clock.advance(20 * DAY);
      await refresh(renewed.body.refreshToken).expect(200);
    });
  });

  describe('RF-21: a session ends 90 days after it started, even if used', () => {
    async function renewEvery20Days(refreshToken: string, until: number) {
      let token = refreshToken;
      let elapsed = 0;
      while (elapsed + 20 * DAY < until) {
        t.clock.advance(20 * DAY);
        elapsed += 20 * DAY;
        token = (await refresh(token).expect(200)).body.refreshToken;
      }
      t.clock.advance(until - elapsed);
      return token;
    }

    it('renews 1 s before the 90 days', async () => {
      const { tokens } = await signedIn();
      const token = await renewEvery20Days(
        tokens.refreshToken,
        90 * DAY - SECOND,
      );
      await refresh(token).expect(200);
    });

    it('does not renew 1 s after the 90 days', async () => {
      const { tokens } = await signedIn();
      const token = await renewEvery20Days(
        tokens.refreshToken,
        90 * DAY + SECOND,
      );
      expectAuthenticationRequired(await refresh(token));
    });
  });

  describe('RF-36: a reused refresh token reveals a copied session', () => {
    it('ends that session: neither the old nor the new token works any more', async () => {
      const { tokens } = await signedIn();
      const renewed = await refresh(tokens.refreshToken).expect(200);

      expectAuthenticationRequired(await refresh(tokens.refreshToken));
      expectAuthenticationRequired(await refresh(renewed.body.refreshToken));

      const session = await sessionOf(tokens.refreshToken);
      expect(session.endReason).toBe('COPIED');
      expect(session.endedAt).toEqual(t.clock.now());
    });

    it('does not affect the other sessions of the user', async () => {
      const { email, tokens } = await signedIn();
      const other = await signedIn(email);
      await refresh(tokens.refreshToken).expect(200);
      expectAuthenticationRequired(await refresh(tokens.refreshToken));

      await refresh(other.tokens.refreshToken).expect(200);
    });

    it('two simultaneous renewals with the same token: one wins, the other ends the session (D18)', async () => {
      const { tokens } = await signedIn();
      const [a, b] = await Promise.all([
        refresh(tokens.refreshToken),
        refresh(tokens.refreshToken),
      ]);

      expect([a.status, b.status].sort((x, y) => x - y)).toEqual([200, 401]);
      const winner = a.status === 200 ? a : b;
      expectAuthenticationRequired(await refresh(winner.body.refreshToken));
      expect((await sessionOf(tokens.refreshToken)).endReason).toBe('COPIED');
    });
  });

  it('RNF-4: a renewal that crosses a sign-out never issues a token after the sign-out', async () => {
    const { tokens } = await signedIn();
    const session = await sessionOf(tokens.refreshToken);

    // A sign-out holds the session row while it ends the session…
    let renewal: Promise<request.Response> | undefined;
    await t.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${session.id}::uuid FOR UPDATE`;
      // …and a renewal arrives in the meantime.
      renewal = refresh(tokens.refreshToken).then((r) => r);
      await sleep(200);
      await tx.session.update({
        where: { id: session.id },
        data: { endedAt: t.clock.now(), endReason: 'LOGOUT' },
      });
    });

    expectAuthenticationRequired(await renewal!);
  });
});
