import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { z } from 'zod';
import { Public } from '../http/public.decorator.js';
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
}
