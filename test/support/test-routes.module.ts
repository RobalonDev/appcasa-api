import { Controller, Get, Module } from '@nestjs/common';
import {
  type AuthenticatedSession,
  CurrentSession,
} from '../../src/identity/current-session.decorator.js';

/**
 * Routes that exist only in e2e tests (plan 001, test strategy): a protected endpoint
 * to check that an access token works, without adding product routes.
 */
@Controller('__test')
class TestRoutesController {
  @Get('session')
  session(
    @CurrentSession() session: AuthenticatedSession,
  ): AuthenticatedSession {
    return session;
  }
}

@Module({ controllers: [TestRoutesController] })
export class TestRoutesModule {}
