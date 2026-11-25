import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

/** Who is calling, as proven by a valid access token (ADR-0008). */
export interface AuthenticatedSession {
  userId: string;
  sessionId: string;
}

/** Where the access-token guard leaves the session on the request. */
export const SESSION_KEY = Symbol('authenticatedSession');

export type RequestWithSession = Request & {
  [SESSION_KEY]?: AuthenticatedSession;
};

/**
 * The authenticated user and session of the request (ADR-0012). Only meaningful on
 * routes that are not `@Public()`: the global guard has already checked the token.
 */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedSession => {
    const session = context.switchToHttp().getRequest<RequestWithSession>()[
      SESSION_KEY
    ];
    if (!session) {
      throw new Error('@CurrentSession() used on a route without a session');
    }
    return session;
  },
);
