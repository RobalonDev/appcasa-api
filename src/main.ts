import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import type { Env } from './config/env.js';
import { configureApp } from './http/configure-app.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  configureApp(app);

  // Run onModuleDestroy hooks (e.g. close DB pool) on SIGTERM/SIGINT,
  // which is how containers and orchestrators stop the process.
  app.enableShutdownHooks();

  const config = app.get<ConfigService<Env, true>>(ConfigService);
  const port = config.get('PORT', { infer: true });

  await app.listen(port);
  Logger.log(`AppCasa API listening on port ${port}`, 'Bootstrap');
}
await bootstrap();
