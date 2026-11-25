import { HttpStatus, Injectable } from '@nestjs/common';
import { Clock } from '../clock/clock.js';
import { lockKey } from '../database/lock-key.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { ProblemException } from '../http/problem.js';
import { authenticationRequired } from './access-token.guard.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TokensService,
} from './crypto/tokens.service.js';
import { lockedUntil, SIGN_IN_LOCKOUT } from './domain/attempt-window.js';
import { isSessionExpired } from './domain/session-expiry.js';
import { EMAIL_LOCK } from './email-lock.js';

/** What registering, signing in and renewing return (plan 001, API contract). */
export interface SessionTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
}

type RenewResult =
  { kind: 'renewed'; tokens: SessionTokens } | { kind: 'rejected' };

type SignInResult =
  | { kind: 'signed-in'; tokens: SessionTokens }
  | { kind: 'invalid-credentials' };

/** RF-13, RF-22: one answer for an unknown email, a wrong password and a lockout. */
function invalidCredentials(): ProblemException {
  return new ProblemException({
    status: HttpStatus.UNAUTHORIZED,
    code: 'INVALID_CREDENTIALS',
  });
}

@Injectable()
export class SessionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokensService,
  ) {}

  /**
   * Sign-in (plan «Iniciar sesión»). Under the email lock, so concurrent wrong
   * passwords are counted exactly (RNF-3). Every path computes exactly one password
   * hash, so timing does not reveal whether the email has an account (RNF-2).
   * Nothing is thrown inside the transaction: the failures it records must commit.
   */
  async signIn(email: string, password: string): Promise<SessionTokens> {
    const result = await this.prisma.$transaction(
      async (tx): Promise<SignInResult> => {
        await lockKey(tx, EMAIL_LOCK, email);
        const now = this.clock.now();
        const invalid = { kind: 'invalid-credentials' } as const;

        // RF-22: locked → rejected even with the right password, and not counted (RF-31).
        if (await this.isSignInLocked(tx, email, now)) {
          await this.hasher.verify(null, password);
          return invalid;
        }

        const user = await tx.user.findUnique({ where: { email } });
        const matches = await this.hasher.verify(
          user?.passwordHash ?? null,
          password,
        );
        if (!user || !matches) {
          // A failed attempt, for an existing email or not (RF-22).
          await tx.loginAttempt.create({
            data: { email, at: now, outcome: 'FAILURE' },
          });
          return invalid;
        }

        // A success resets the count of failures (RF-22).
        await tx.loginAttempt.create({
          data: { email, at: now, outcome: 'SUCCESS' },
        });
        if (this.hasher.needsRehash(user.passwordHash)) {
          await tx.user.update({
            where: { id: user.id },
            data: { passwordHash: await this.hasher.hash(password) },
          });
        }
        const tokens = await this.createSession(tx, user.id, now);
        return { kind: 'signed-in', tokens };
      },
      { timeout: 15_000 },
    );

    if (result.kind === 'invalid-credentials') {
      throw invalidCredentials();
    }
    return result.tokens;
  }

  /**
   * Starts a new session for `userId` (RF-5, RF-17): a Session row whose idle time
   * counts from now, its first refresh token (stored only as a hash) and an access
   * token. Runs inside the caller's transaction, so that registration can create the
   * account and its session atomically.
   */
  async createSession(
    tx: Prisma.TransactionClient,
    userId: string,
    now: Date,
  ): Promise<SessionTokens> {
    const session = await tx.session.create({
      data: { userId, createdAt: now, lastUsedAt: now },
    });
    return this.issueTokens(tx, userId, session.id, now);
  }

  /**
   * Renews a session with its refresh token (plan «Renovar la sesión», ADR-0008):
   * rotates the token and records the renewal as the session's last use (RF-20).
   * A token that was already used reveals a copied session, which ends (RF-36).
   * The session row is locked before the token, always in that order, so a renewal
   * and a sign-out of the same session run one after the other (RNF-4).
   */
  async refresh(refreshToken: string): Promise<SessionTokens> {
    const tokenHash = this.tokens.hashRefreshToken(refreshToken);
    const result = await this.prisma.$transaction(
      async (tx): Promise<RenewResult> => {
        const rejected = { kind: 'rejected' } as const;
        const found = await tx.refreshToken.findUnique({
          where: { tokenHash },
          select: { sessionId: true },
        });
        if (!found) {
          return rejected;
        }
        await lockSession(tx, found.sessionId);
        const now = this.clock.now();
        // Read again under the lock: a concurrent renewal or sign-out has finished.
        const token = await tx.refreshToken.findUniqueOrThrow({
          where: { tokenHash },
          include: { session: true },
        });
        const { session } = token;

        if (token.usedAt !== null) {
          if (session.endedAt === null) {
            await tx.session.update({
              where: { id: session.id },
              data: { endedAt: now, endReason: 'COPIED' },
            });
          }
          return rejected;
        }
        if (session.endedAt !== null || isSessionExpired(session, now)) {
          return rejected;
        }

        await tx.refreshToken.update({
          where: { id: token.id },
          data: { usedAt: now },
        });
        await tx.session.update({
          where: { id: session.id },
          data: { lastUsedAt: now },
        });
        const tokens = await this.issueTokens(
          tx,
          session.userId,
          session.id,
          now,
        );
        return { kind: 'renewed', tokens };
      },
    );

    if (result.kind === 'rejected') {
      throw authenticationRequired();
    }
    return result.tokens;
  }

  /** A new refresh token for the session (stored only as a hash) and an access token. */
  private async issueTokens(
    tx: Prisma.TransactionClient,
    userId: string,
    sessionId: string,
    now: Date,
  ): Promise<SessionTokens> {
    const refreshToken = this.tokens.generateRefreshToken();
    await tx.refreshToken.create({
      data: {
        sessionId,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        createdAt: now,
      },
    });
    const accessToken = await this.tokens.signAccessToken(
      { userId, sessionId },
      now,
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    };
  }

  private async isSignInLocked(
    tx: Prisma.TransactionClient,
    email: string,
    now: Date,
  ): Promise<boolean> {
    const lookback = SIGN_IN_LOCKOUT.windowMs + SIGN_IN_LOCKOUT.lockMs;
    const attempts = await tx.loginAttempt.findMany({
      where: { email, at: { gt: new Date(now.getTime() - lookback) } },
      select: { at: true, outcome: true },
    });
    return lockedUntil(attempts, SIGN_IN_LOCKOUT, now) !== null;
  }
}

/**
 * Row lock on a session (Prisma has no SELECT … FOR UPDATE). Every operation that ends
 * or renews a session takes it first, before touching its refresh tokens (plan 001,
 * «Sesiones: orden de bloqueo»).
 */
async function lockSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
): Promise<void> {
  await tx.$queryRaw`SELECT id FROM sessions WHERE id = ${sessionId}::uuid FOR UPDATE`;
}
