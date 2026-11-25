const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

/**
 * RF-20: 30 days without use. The real last use can be up to 5 minutes after the last
 * renewal (the access token's life), so the session ends at last renewal + 30 d + 5 min:
 * never early, and at most 5 minutes late, within the «sesión válida» tolerance
 * (ADR-0008, precisión del 2026-11-24).
 */
const IDLE_LIMIT_MS = 30 * DAY + 5 * MINUTE;
/** RF-21: 90 days after it started, used or not. */
const ABSOLUTE_LIMIT_MS = 90 * DAY;

/** Expiry is computed, not stored (plan 001, data model). */
export function isSessionExpired(
  session: { createdAt: Date; lastUsedAt: Date },
  now: Date,
): boolean {
  const time = now.getTime();
  return (
    time - session.lastUsedAt.getTime() >= IDLE_LIMIT_MS ||
    time - session.createdAt.getTime() >= ABSOLUTE_LIMIT_MS
  );
}
