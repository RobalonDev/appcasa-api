import { ControllableClock } from './controllable-clock.js';
import { SystemClock } from './clock.js';

describe('SystemClock (ADR-0012)', () => {
  it('returns the current time', () => {
    const before = Date.now();
    const now = new SystemClock().now().getTime();
    expect(now).toBeGreaterThanOrEqual(before);
    expect(now).toBeLessThanOrEqual(Date.now());
  });
});

describe('ControllableClock (ADR-0012)', () => {
  const start = new Date('2026-01-01T00:00:00.000Z');

  it('starts at the given instant and stays there', () => {
    const clock = new ControllableClock(start);
    expect(clock.now()).toEqual(start);
    expect(clock.now()).toEqual(start);
  });

  it('advances by a number of milliseconds', () => {
    const clock = new ControllableClock(start);
    clock.advance(15 * 60_000 + 1_000);
    expect(clock.now().toISOString()).toBe('2026-01-01T00:15:01.000Z');
  });

  it('can be set to any instant', () => {
    const clock = new ControllableClock(start);
    clock.set(new Date('2026-03-31T12:00:00.000Z'));
    expect(clock.now().toISOString()).toBe('2026-03-31T12:00:00.000Z');
  });

  it('returns copies, so callers cannot move it by mutating the date', () => {
    const clock = new ControllableClock(start);
    clock.now().setFullYear(2030);
    expect(clock.now()).toEqual(start);
  });
});
