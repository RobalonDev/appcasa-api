import { createHash } from 'node:crypto';
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

interface Tokens {
  accessToken: string;
  refreshToken: string;
}

describe('Sign out (e2e)', () => {
  let t: IdentityTestApp;
  let passwordHash: string;

  beforeAll(async () => {
    t = await createIdentityTestApp();
    passwordHash = await t.app.get(PasswordHasher).hash(PASSWORD);
  });

  afterAll(async () => {
    await t.app.close();
  });

  const server = () => t.app.getHttpServer();

  async function newUser(): Promise<string> {
    const email = uniqueEmail();
    await t.prisma.user.create({
      data: {
        email,
        displayName: 'Ana',
        passwordHash,
        createdAt: t.clock.now(),
      },
    });
    return email;
  }

  async function signIn(email: string): Promise<Tokens> {
    const response = await request(server())
      .post('/auth/sessions')
      .send({ email, password: PASSWORD })
      .expect(201);
    return response.body as Tokens;
  }

  const signOut = (refreshToken: unknown) =>
    request(server()).delete('/auth/sessions/current').send({ refreshToken });

  const signOutEverywhere = (accessToken?: string) => {
    const req = request(server()).delete('/auth/sessions');
    return accessToken
      ? req.set('Authorization', `Bearer ${accessToken}`)
      : req;
  };

  const refresh = (refreshToken: string) =>
    request(server()).post('/auth/sessions/refresh').send({ refreshToken });

  const protectedRoute = (accessToken: string) =>
    request(server())
      .get('/__test/session')
      .set('Authorization', `Bearer ${accessToken}`);

  async function sessionOf(refreshToken: string) {
    const token = await t.prisma.refreshToken.findUniqueOrThrow({
      where: {
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      },
      include: { session: true },
    });
    return token.session;
  }

  function expectAuthenticationRequired(response: request.Response) {
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ code: 'AUTHENTICATION_REQUIRED' });
  }

  describe('RF-18: signing out ends only the session making the request', () => {
    it('ends it: its refresh token stops working, another session keeps working', async () => {
      const email = await newUser();
      const phone = await signIn(email);
      const laptop = await signIn(email);

      await signOut(phone.refreshToken).expect(204);

      expectAuthenticationRequired(await refresh(phone.refreshToken));
      await refresh(laptop.refreshToken).expect(200);
      expect((await sessionOf(phone.refreshToken)).endReason).toBe('LOGOUT');
    });

    it('works even when the access token has expired (spec D21)', async () => {
      const tokens = await signIn(await newUser());
      t.clock.advance(10 * MINUTE);
      await signOut(tokens.refreshToken).expect(204);
    });

    it('rejects an unknown token, a session already ended and a malformed request', async () => {
      const tokens = await signIn(await newUser());
      await signOut(tokens.refreshToken).expect(204);

      expectAuthenticationRequired(await signOut(tokens.refreshToken));
      expectAuthenticationRequired(await signOut('not-a-real-token'));
      const response = await signOut(undefined).expect(400);
      expect(response.body.errors).toEqual([
        { field: 'refreshToken', code: 'INVALID_FIELD' },
      ]);
    });
  });

  it('RF-36: signing out with an already-used refresh token reveals a copy and ends the session', async () => {
    const tokens = await signIn(await newUser());
    const renewed = await refresh(tokens.refreshToken).expect(200);

    expectAuthenticationRequired(await signOut(tokens.refreshToken));

    expect((await sessionOf(tokens.refreshToken)).endReason).toBe('COPIED');
    expectAuthenticationRequired(await refresh(renewed.body.refreshToken));
  });

  describe('RF-19: signing out everywhere ends every session the user has at that moment', () => {
    it('ends all of them, the calling one included', async () => {
      const email = await newUser();
      const sessions = [
        await signIn(email),
        await signIn(email),
        await signIn(email),
      ];

      await signOutEverywhere(sessions[0]?.accessToken).expect(204);

      for (const tokens of sessions) {
        expectAuthenticationRequired(await refresh(tokens.refreshToken));
        expect((await sessionOf(tokens.refreshToken)).endReason).toBe(
          'LOGOUT_ALL',
        );
      }
    });

    it('does not affect sessions created afterwards, nor other users', async () => {
      const email = await newUser();
      const before = await signIn(email);
      const someoneElse = await signIn(await newUser());

      await signOutEverywhere(before.accessToken).expect(204);
      const after = await signIn(email);

      await refresh(after.refreshToken).expect(200);
      await refresh(someoneElse.refreshToken).expect(200);
    });

    it('needs a valid access token', async () => {
      expectAuthenticationRequired(await signOutEverywhere());
      expectAuthenticationRequired(await signOutEverywhere('not.a.token'));
    });
  });

  describe('RNF-4: a finished session stops working within 5 minutes', () => {
    it('after signing out, the refresh token dies at once and the access token within 5 minutes', async () => {
      const tokens = await signIn(await newUser());
      await signOut(tokens.refreshToken).expect(204);

      expectAuthenticationRequired(await refresh(tokens.refreshToken));
      t.clock.advance(5 * MINUTE - SECOND);
      await protectedRoute(tokens.accessToken).expect(200);
      t.clock.advance(SECOND);
      expectAuthenticationRequired(await protectedRoute(tokens.accessToken));
    });

    it('the same after signing out everywhere: a lost phone keeps access for 5 minutes at most', async () => {
      const email = await newUser();
      const lostPhone = await signIn(email);
      const laptop = await signIn(email);
      await signOutEverywhere(laptop.accessToken).expect(204);

      expectAuthenticationRequired(await refresh(lostPhone.refreshToken));
      t.clock.advance(5 * MINUTE);
      expectAuthenticationRequired(await protectedRoute(lostPhone.accessToken));
    });
  });

  it('RNF-1: every identity route needs a credential except the public ones', async () => {
    const publicRoutes: [string, () => request.Test][] = [
      [
        'request registration',
        () => request(server()).post('/auth/registration-requests').send({}),
      ],
      [
        'complete registration',
        () => request(server()).post('/auth/registrations').send({}),
      ],
      ['sign in', () => request(server()).post('/auth/sessions').send({})],
    ];
    for (const [name, call] of publicRoutes) {
      const response = await call();
      expect({ name, status: response.status }).toEqual({ name, status: 400 });
    }

    // Authenticated by the session's refresh token (spec D21): without it, 401.
    expectAuthenticationRequired(await refresh('none'));
    expectAuthenticationRequired(await signOut('none'));
    // Authenticated by the access token.
    expectAuthenticationRequired(await signOutEverywhere());
    expectAuthenticationRequired(
      await request(server()).get('/__test/session'),
    );
  });
});
