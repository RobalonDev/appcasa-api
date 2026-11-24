import {
  createHash,
  createHmac,
  type KeyObject,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

/** ADR-0008: access tokens live 5 minutes, which bounds RNF-4. */
export const ACCESS_TOKEN_TTL_SECONDS = 300;

const ISSUER = 'appcasa';
const AUDIENCE = 'appcasa';
const REFRESH_TOKEN_BYTES = 32;

export interface AccessTokenClaims {
  userId: string;
  sessionId: string;
}

export interface TokensOptions {
  privateKey: KeyObject;
  publicKey: KeyObject;
  /** Key of the HMAC that stores verification codes. */
  codeSecret: string;
}

const seconds = (date: Date) => Math.floor(date.getTime() / 1000);

/**
 * Token cryptography of the identity module (ADR-0008, plan 001):
 * EdDSA access tokens, opaque refresh tokens stored as SHA-256, and the HMAC of
 * verification codes. Every method that depends on time takes `now` explicitly
 * (it comes from the Clock, ADR-0012).
 */
export class TokensService {
  constructor(private readonly options: TokensOptions) {}

  signAccessToken(claims: AccessTokenClaims, now: Date): Promise<string> {
    const issuedAt = seconds(now);
    return new SignJWT({ sid: claims.sessionId })
      .setProtectedHeader({ alg: 'EdDSA', typ: 'JWT' })
      .setIssuer(ISSUER)
      .setAudience(AUDIENCE)
      .setSubject(claims.userId)
      .setIssuedAt(issuedAt)
      .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
      .sign(this.options.privateKey);
  }

  /**
   * The claims of a valid access token, or `null` for anything else (RF-33):
   * only EdDSA is accepted (never "none" or HS256), issuer and audience must match,
   * and there is no clock tolerance.
   */
  async verifyAccessToken(
    token: string,
    now: Date,
  ): Promise<AccessTokenClaims | null> {
    try {
      const { payload } = await jwtVerify(token, this.options.publicKey, {
        algorithms: ['EdDSA'],
        issuer: ISSUER,
        audience: AUDIENCE,
        currentDate: now,
        clockTolerance: 0,
        requiredClaims: ['sub', 'sid', 'iat', 'exp'],
      });
      if (typeof payload.sub !== 'string' || typeof payload.sid !== 'string') {
        return null;
      }
      return { userId: payload.sub, sessionId: payload.sid };
    } catch {
      return null;
    }
  }

  /** 256 random bits, base64url: opaque to the client (ADR-0008). */
  generateRefreshToken(): string {
    return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
  }

  /** Refresh tokens are stored only as their SHA-256 (enough for 256 random bits). */
  hashRefreshToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  /**
   * HMAC-SHA256 of a verification code, bound to its email. A plain hash of 6 digits
   * is reversed in milliseconds; with the HMAC, a database leak alone does not let
   * anyone complete someone else's registration (plan 001, data model).
   */
  hmacVerificationCode(email: string, code: string): string {
    return createHmac('sha256', this.options.codeSecret)
      .update(`${email}:${code}`)
      .digest('hex');
  }

  /** Constant-time comparison of a stored HMAC with the one of `code`. */
  verificationCodeMatches(
    storedHmac: string,
    email: string,
    code: string,
  ): boolean {
    const expected = Buffer.from(storedHmac, 'hex');
    const actual = Buffer.from(this.hmacVerificationCode(email, code), 'hex');
    return (
      expected.length === actual.length && timingSafeEqual(expected, actual)
    );
  }
}
