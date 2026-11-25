import { Injectable } from '@nestjs/common';

/**
 * Single source of time for the application (ADR-0012). Business rules never call
 * `new Date()` or the database's `now()`: they ask the injected Clock, so tests can
 * replace it and check every deadline at its exact edge.
 *
 * Abstract class rather than interface: it doubles as the DI token.
 */
export abstract class Clock {
  abstract now(): Date;
}

@Injectable()
export class SystemClock extends Clock {
  now(): Date {
    return new Date();
  }
}
