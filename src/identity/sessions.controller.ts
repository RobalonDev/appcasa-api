import {
  Body,
  Controller,
  Delete,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../http/public.decorator.js';
import {
  type AuthenticatedSession,
  CurrentSession,
} from './current-session.decorator.js';
import { emailSchema } from './domain/email.js';
import { type SessionTokens, SessionsService } from './sessions.service.js';

/**
 * The email is checked on its own first, so an invalid email is reported alone (RF-35),
 * like in the other operations; the password only has to be text (RF-23 is for
 * registration).
 */
const signInSchema = z
  .object({ email: emailSchema })
  .loose()
  .pipe(
    z.object({
      email: z.string(),
      password: z.string({ error: 'INVALID_FIELD' }),
    }),
  );

const refreshSchema = z.object({
  refreshToken: z.string({ error: 'INVALID_FIELD' }),
});

@Controller('auth/sessions')
export class SessionsController {
  constructor(private readonly sessions: SessionsService) {}

  /** Sign in (RF-13, RF-17, RF-22): answers the new session's tokens. */
  @Public()
  @Post()
  @HttpCode(HttpStatus.CREATED)
  signIn(
    @Body({ schema: signInSchema }) body: z.output<typeof signInSchema>,
  ): Promise<SessionTokens> {
    return this.sessions.signIn(body.email, body.password);
  }

  /**
   * Renews a session (RF-20, RF-21, RF-36). Public for the guard: it is authenticated
   * by the refresh token itself, even when the access token has expired (spec D21).
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body({ schema: refreshSchema }) body: z.output<typeof refreshSchema>,
  ): Promise<SessionTokens> {
    return this.sessions.refresh(body.refreshToken);
  }

  /** Signs out this session only (RF-18), with its refresh token (plan Q2, spec D21). */
  @Public()
  @Delete('current')
  @HttpCode(HttpStatus.NO_CONTENT)
  signOut(
    @Body({ schema: refreshSchema }) body: z.output<typeof refreshSchema>,
  ): Promise<void> {
    return this.sessions.signOut(body.refreshToken);
  }

  /** Signs out every session of the caller (RF-19); needs a valid access token. */
  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  signOutEverywhere(
    @CurrentSession() session: AuthenticatedSession,
  ): Promise<void> {
    return this.sessions.signOutEverywhere(session.userId);
  }
}
