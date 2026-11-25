import { Clock } from './clock.js';

/**
 * Clock for tests (ADR-0012): time only moves when the test says so.
 * Swap it in with `overrideProvider(Clock).useValue(new ControllableClock(...))`.
 */
export class ControllableClock extends Clock {
  private current: number;

  constructor(start: Date = new Date('2026-01-01T00:00:00.000Z')) {
    super();
    this.current = start.getTime();
  }

  now(): Date {
    return new Date(this.current);
  }

  advance(milliseconds: number): void {
    this.current += milliseconds;
  }

  set(instant: Date): void {
    this.current = instant.getTime();
  }
}
