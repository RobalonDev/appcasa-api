import {
  type CanActivate,
  type ExecutionContext,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Clock } from '../clock/clock.js';
import { ProblemException } from '../http/problem.js';
import { IS_PUBLIC_KEY } from '../http/public.decorator.js';
import { TokensService } from './crypto/tokens.service.js';
import {
  type RequestWithSession,
  SESSION_KEY,
} from './current-session.decorator.js';

const BEARER = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

/** RF-33: the same answer for every reason a request has no valid session. */
export function authenticationRequired(): ProblemException {
  return new ProblemException({
    status: HttpStatus.UNAUTHORIZED,
    code: 'AUTHENTICATION_REQUIRED',
    detail: 'Sign in to continue.',
  });
}

/**
 * Global guard (ADR-0012, RNF-1): every route needs a valid access token unless it is
 * marked `@Public()`. Stateless: the token is not looked up in the database, so a
 * finished session keeps working for at most the token's 5 minutes (RNF-4, ADR-0008).
 */
@Injectable()
export class AccessTokenGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly tokens: TokensService,
    private readonly clock: Clock,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean | undefined>(
      IS_PUBLIC_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithSession>();
    const token = BEARER.exec(request.headers.authorization ?? '')?.[1];
    if (!token) {
      throw authenticationRequired();
    }
    const session = await this.tokens.verifyAccessToken(
      token,
      this.clock.now(),
    );
    if (!session) {
      throw authenticationRequired();
    }
    request[SESSION_KEY] = session;
    return true;
  }
}
