export interface Attempt {
  at: Date;
  outcome: 'FAILURE' | 'SUCCESS';
}

/** «`limit` failures within `windowMs` lock the key for `lockMs` after the last of them». */
export interface LockoutRule {
  limit: number;
  windowMs: number;
  lockMs: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** RF-15: 10 failed verifications in 24 h lock that email's codes for 24 h. */
export const VERIFICATION_LOCKOUT: LockoutRule = {
  limit: 10,
  windowMs: 24 * HOUR,
  lockMs: 24 * HOUR,
};

/** RF-22: 5 failed sign-ins in 15 min lock sign-in with that email for 15 min. */
export const SIGN_IN_LOCKOUT: LockoutRule = {
  limit: 5,
  windowMs: 15 * MINUTE,
  lockMs: 15 * MINUTE,
};

/**
 * End of the lockout in force at `now`, or `null` if the key is not locked.
 *
 * - Only failures after the last success count: a success resets the count (RF-22).
 *   During a lockout nothing succeeds, so no lockout straddles a success.
 * - A lockout starts at a failure that completes `limit` failures within `windowMs`
 *   (window edges included) and lasts `lockMs`; at exactly that end it is over.
 * - The input holds only attempts that counted: attempts rejected during a lockout are
 *   never recorded (RF-31, D16), so they can never extend it.
 */
export function lockedUntil(
  attempts: readonly Attempt[],
  rule: LockoutRule,
  now: Date,
): Date | null {
  const sorted = [...attempts].sort((a, b) => a.at.getTime() - b.at.getTime());
  const lastSuccess = sorted.findLastIndex((a) => a.outcome === 'SUCCESS');
  const failures = sorted
    .slice(lastSuccess + 1)
    .filter((a) => a.outcome === 'FAILURE')
    .map((a) => a.at.getTime());

  let until: number | null = null;
  for (let i = rule.limit - 1; i < failures.length; i++) {
    const last = failures[i];
    const first = failures[i - (rule.limit - 1)];
    if (last === undefined || first === undefined) {
      continue;
    }
    if (last - first <= rule.windowMs) {
      until = Math.max(until ?? 0, last + rule.lockMs);
    }
  }

  return until !== null && now.getTime() < until ? new Date(until) : null;
}

/**
 * Whether a failed attempt at `now` must be recorded: not while locked (RF-31, and the
 * definition of «intento fallido de verificación» for RF-15).
 */
export function countsAsFailure(
  attempts: readonly Attempt[],
  rule: LockoutRule,
  now: Date,
): boolean {
  return lockedUntil(attempts, rule, now) === null;
}
