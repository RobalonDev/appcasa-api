import { isSessionExpired } from './session-expiry.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const DAY = 24 * 60 * MINUTE;
const t0 = new Date('2026-01-01T00:00:00.000Z').getTime();
const at = (ms: number) => new Date(t0 + ms);

describe('isSessionExpired', () => {
  const fresh = { createdAt: at(0), lastUsedAt: at(0) };

  it('RF-20: not expired 30 days after the last use, nor within the 5-minute tolerance', () => {
    expect(isSessionExpired(fresh, at(30 * DAY))).toBe(false);
    expect(isSessionExpired(fresh, at(30 * DAY + 5 * MINUTE - SECOND))).toBe(
      false,
    );
  });

  it('RF-20: expired 30 days and 5 minutes after the last use', () => {
    expect(isSessionExpired(fresh, at(30 * DAY + 5 * MINUTE))).toBe(true);
  });

  it('RF-20: counts from the last renewal', () => {
    const renewed = { createdAt: at(0), lastUsedAt: at(20 * DAY) };
    expect(isSessionExpired(renewed, at(45 * DAY))).toBe(false);
  });

  it('RF-21: expired 90 days after creation, however recently used', () => {
    const busy = { createdAt: at(0), lastUsedAt: at(90 * DAY - MINUTE) };
    expect(isSessionExpired(busy, at(90 * DAY - SECOND))).toBe(false);
    expect(isSessionExpired(busy, at(90 * DAY))).toBe(true);
  });
});
