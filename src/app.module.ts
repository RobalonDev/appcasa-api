import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envSchema } from './config/env.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthModule } from './health/health.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationSchema: envSchema,
      // Only serve validated variables through ConfigService.
      skipProcessEnv: true,
    }),
    DatabaseModule,
    HealthModule,
  ],
})
export class AppModule {}
