import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { MailSender } from './mail-sender.js';
import { SmtpMailSender } from './smtp-mail-sender.js';

/**
 * Shared mail infrastructure (ADR-0009). Modules depend on the `MailSender` port;
 * tests replace it with `InMemoryMailSender`.
 */
@Module({
  providers: [
    {
      provide: MailSender,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        new SmtpMailSender(
          config.get('SMTP_URL', { infer: true }),
          config.get('MAIL_FROM', { infer: true }),
        ),
    },
  ],
  exports: [MailSender],
})
export class MailModule {}
