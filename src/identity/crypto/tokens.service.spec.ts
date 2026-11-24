import { createHmac, generateKeyPairSync } from 'node:crypto';
import { SignJWT } from 'jose';
import { ACCESS_TOKEN_TTL_SECONDS, TokensService } from './tokens.service.js';

function ed25519() {
  return generateKeyPairSync('ed25519');
}

describe('TokensService (ADR-0008)', () => {
  const keys = ed25519();
  const tokens = new TokensService({
    privateKey: keys.privateKey,
    publicKey: keys.publicKey,
    codeSecret: 'x'.repeat(32),
  });
  const now = new Date('2026-01-01T00:00:00.000Z');
  const later = (seconds: number) => new Date(now.getTime() + seconds * 1000);
  const claims = {
    userId: '0198e6a4-0000-7000-8000-000000000001',
    sessionId: '0198e6a4-0000-7000-8000-000000000002',
  };

  describe('access tokens', () => {
    it('lasts 5 minutes', () => {
      expect(ACCESS_TOKEN_TTL_SECONDS).toBe(300);
    });

    it('round-trips the user and the session', async () => {
      const token = await tokens.signAccessToken(claims, now);
      await expect(
        tokens.verifyAccessToken(token, later(299)),
      ).resolves.toEqual(claims);
    });

    it('is signed with EdDSA and carries iss, aud, sub, sid, iat and exp', async () => {
      const token = await tokens.signAccessToken(claims, now);
      const [header, payload] = token
        .split('.')
        .slice(0, 2)
        .map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()));

      expect(header).toEqual({ alg: 'EdDSA', typ: 'JWT' });
      expect(payload).toEqual({
        iss: 'appcasa',
        aud: 'appcasa',
        sub: claims.userId,
        sid: claims.sessionId,
        iat: now.getTime() / 1000,
        exp: now.getTime() / 1000 + 300,
      });
    });

    describe('RF-33: rejects any token that is not a valid session', () => {
      it('rejects it once 5 minutes have passed, with no clock tolerance', async () => {
        const token = await tokens.signAccessToken(claims, now);
        await expect(
          tokens.verifyAccessToken(token, later(300)),
        ).resolves.toBeNull();
      });

      it('rejects a tampered payload', async () => {
        const token = await tokens.signAccessToken(claims, now);
        const [header, , signature] = token.split('.');
        const forged = Buffer.from(
          JSON.stringify({ ...claims, sub: 'someone-else' }),
        ).toString('base64url');
        await expect(
          tokens.verifyAccessToken(`${header}.${forged}.${signature}`, now),
        ).resolves.toBeNull();
      });

      it('rejects a token signed with another key', async () => {
        const other = ed25519();
        const intruder = new TokensService({
          privateKey: other.privateKey,
          publicKey: other.publicKey,
          codeSecret: 'y'.repeat(32),
        });
        const token = await intruder.signAccessToken(claims, now);
        await expect(tokens.verifyAccessToken(token, now)).resolves.toBeNull();
      });

      it('rejects another algorithm, even with valid-looking claims (HS256)', async () => {
        const token = await new SignJWT({ sid: claims.sessionId })
          .setProtectedHeader({ alg: 'HS256' })
          .setSubject(claims.userId)
          .setIssuer('appcasa')
          .setAudience('appcasa')
          .setIssuedAt(now)
          .setExpirationTime(later(300))
          .sign(new TextEncoder().encode('z'.repeat(32)));
        await expect(tokens.verifyAccessToken(token, now)).resolves.toBeNull();
      });

      it('rejects an unsigned token (alg "none")', async () => {
        const encode = (value: object) =>
          Buffer.from(JSON.stringify(value)).toString('base64url');
        const token = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
          iss: 'appcasa',
          aud: 'appcasa',
          sub: claims.userId,
          sid: claims.sessionId,
          exp: now.getTime() / 1000 + 300,
        })}.`;
        await expect(tokens.verifyAccessToken(token, now)).resolves.toBeNull();
      });

      it('rejects a wrong issuer or audience', async () => {
        for (const [issuer, audience] of [
          ['evil', 'appcasa'],
          ['appcasa', 'evil'],
        ] as const) {
          const token = await new SignJWT({ sid: claims.sessionId })
            .setProtectedHeader({ alg: 'EdDSA' })
            .setSubject(claims.userId)
            .setIssuer(issuer)
            .setAudience(audience)
            .setIssuedAt(now)
            .setExpirationTime(later(300))
            .sign(keys.privateKey);
          await expect(
            tokens.verifyAccessToken(token, now),
          ).resolves.toBeNull();
        }
      });

      it('rejects a token without a session id', async () => {
        const token = await new SignJWT({})
          .setProtectedHeader({ alg: 'EdDSA' })
          .setSubject(claims.userId)
          .setIssuer('appcasa')
          .setAudience('appcasa')
          .setIssuedAt(now)
          .setExpirationTime(later(300))
          .sign(keys.privateKey);
        await expect(tokens.verifyAccessToken(token, now)).resolves.toBeNull();
      });

      it('rejects garbage', async () => {
        for (const token of ['', 'abc', 'a.b.c']) {
          await expect(
            tokens.verifyAccessToken(token, now),
          ).resolves.toBeNull();
        }
      });
    });
  });

  describe('refresh tokens', () => {
    it('are 256 random bits, base64url', () => {
      const token = tokens.generateRefreshToken();
      expect(Buffer.from(token, 'base64url')).toHaveLength(32);
      expect(token).not.toBe(tokens.generateRefreshToken());
    });

    it('are stored as their SHA-256, never in clear', () => {
      const token = tokens.generateRefreshToken();
      const hash = tokens.hashRefreshToken(token);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
      expect(hash).toBe(tokens.hashRefreshToken(token));
      expect(hash).not.toContain(token);
    });
  });

  describe('verification code HMAC', () => {
    it('is an HMAC-SHA256 with the configured secret, bound to the email', () => {
      const expected = createHmac('sha256', 'x'.repeat(32))
        .update('ana@example.com:012345')
        .digest('hex');
      expect(tokens.hmacVerificationCode('ana@example.com', '012345')).toBe(
        expected,
      );
    });

    it('differs for the same code sent to another email', () => {
      expect(tokens.hmacVerificationCode('ana@example.com', '012345')).not.toBe(
        tokens.hmacVerificationCode('bea@example.com', '012345'),
      );
    });

    it('compares in constant time and tolerates malformed input', () => {
      const hmac = tokens.hmacVerificationCode('ana@example.com', '012345');
      expect(
        tokens.verificationCodeMatches(hmac, 'ana@example.com', '012345'),
      ).toBe(true);
      expect(
        tokens.verificationCodeMatches(hmac, 'ana@example.com', '012346'),
      ).toBe(false);
      expect(
        tokens.verificationCodeMatches('short', 'ana@example.com', '012345'),
      ).toBe(false);
    });
  });
});
