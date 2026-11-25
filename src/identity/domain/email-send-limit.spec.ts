import { mayEmail } from './email-send-limit.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const t0 = new Date('2026-01-01T12:00:00.000Z').getTime();
const at = (ms: number) => new Date(t0 + ms);

describe('mayEmail', () => {
  it('RF-12: allows the first email', () => {
    expect(mayEmail([], at(0))).toBe(true);
  });

  it('RF-12: refuses a second email within the last minute', () => {
    expect(mayEmail([at(0)], at(59 * SECOND))).toBe(false);
  });

  it('RF-12: allows it once a full minute has passed', () => {
    expect(mayEmail([at(0)], at(MINUTE))).toBe(true);
  });

  it('RF-12: refuses a sixth email within the last hour', () => {
    const five = [0, 2, 4, 6, 8].map((m) => at(m * MINUTE));
    expect(mayEmail(five, at(10 * MINUTE))).toBe(false);
  });

  it('RF-12: allows it once the oldest of the five leaves the hour', () => {
    const five = [0, 2, 4, 6, 8].map((m) => at(m * MINUTE));
    expect(mayEmail(five, at(60 * MINUTE))).toBe(true);
  });

  it('ignores sends older than one hour', () => {
    const old = Array.from({ length: 10 }, (_, i) =>
      at(-(2 * 60 + i) * MINUTE),
    );
    expect(mayEmail(old, at(0))).toBe(true);
  });
});
