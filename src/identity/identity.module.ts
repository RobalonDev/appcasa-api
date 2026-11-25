import { createPrivateKey, createPublicKey } from 'node:crypto';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { MailModule } from '../mail/mail.module.js';
import { AccessTokenGuard } from './access-token.guard.js';
import { AuthEmailJobs, InMemoryAuthEmailJobs } from './auth-email-jobs.js';
import { TokensService } from './crypto/tokens.service.js';
import { RegistrationEmailJob } from './registration-email.job.js';
import { RegistrationController } from './registration.controller.js';
import { RegistrationService } from './registration.service.js';
import { SessionsService } from './sessions.service.js';

/**
 * Identity bounded context (ADR-0003): accounts, registration and sessions.
 * Global, not tied to any household (ADR-0006 exception).
 */
@Module({
  imports: [MailModule],
  controllers: [RegistrationController],
  providers: [
    RegistrationService,
    RegistrationEmailJob,
    SessionsService,
    // Deny by default: every route of every module needs a session (ADR-0012, RNF-1).
    { provide: APP_GUARD, useClass: AccessTokenGuard },
    { provide: AuthEmailJobs, useClass: InMemoryAuthEmailJobs },
    {
      provide: TokensService,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new TokensService({
          privateKey: createPrivateKey(
            config.get('JWT_PRIVATE_KEY', { infer: true }),
          ),
          publicKey: createPublicKey(
            config.get('JWT_PUBLIC_KEY', { infer: true }),
          ),
          codeSecret: config.get('VERIFICATION_CODE_SECRET', { infer: true }),
        }),
    },
  ],
  exports: [SessionsService],
})
export class IdentityModule {}
