import { randomUUID } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModuleBuilder } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { AppModule } from '../../src/app.module.js';
import { PrismaService } from '../../src/database/prisma.service.js';
import { configureApp } from '../../src/http/configure-app.js';
import { TestRoutesModule } from './test-routes.module.js';

export interface TestApp {
  app: INestApplication<App>;
  prisma: PrismaService;
}

/**
 * Boots the real application for e2e tests, configured exactly like `main.ts`
 * (ADR-0012), plus the test-only routes of `TestRoutesModule`.
 * `override` lets a test swap providers (clock, mail sender…).
 * Requires the local database with migrations applied: `pnpm infra:up && pnpm db:migrate`.
 */
export async function createTestApp(
  override: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<TestApp> {
  const moduleRef = await override(
    Test.createTestingModule({ imports: [AppModule, TestRoutesModule] }),
  ).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}

/**
 * A fresh email for each test. E2E tests isolate their data by email instead of
 * truncating tables, so they never wipe what a developer created by hand.
 */
export function uniqueEmail(label = 'user'): string {
  return `${label}-${randomUUID()}@example.test`;
}
