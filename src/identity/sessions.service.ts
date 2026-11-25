import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import {
  ACCESS_TOKEN_TTL_SECONDS,
  TokensService,
} from './crypto/tokens.service.js';

/** What registering or signing in returns (plan 001, API contract). */
export interface SessionTokens {
  accessToken: string;
  tokenType: 'Bearer';
  expiresIn: number;
  refreshToken: string;
}

@Injectable()
export class SessionsService {
  constructor(private readonly tokens: TokensService) {}

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
    const refreshToken = this.tokens.generateRefreshToken();
    await tx.refreshToken.create({
      data: {
        sessionId: session.id,
        tokenHash: this.tokens.hashRefreshToken(refreshToken),
        createdAt: now,
      },
    });
    const accessToken = await this.tokens.signAccessToken(
      { userId, sessionId: session.id },
      now,
    );
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      refreshToken,
    };
  }
}
