import {
  type Attempt,
  countsAsFailure,
  lockedUntil,
  SIGN_IN_LOCKOUT,
  VERIFICATION_LOCKOUT,
} from './attempt-window.js';

const SECOND = 1_000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const t0 = new Date('2026-01-01T00:00:00.000Z').getTime();
const at = (ms: number) => new Date(t0 + ms);
const failure = (ms: number): Attempt => ({ at: at(ms), outcome: 'FAILURE' });
const success = (ms: number): Attempt => ({ at: at(ms), outcome: 'SUCCESS' });

/** `count` failures, one every `stepMs`, starting at t0. */
function failures(count: number, stepMs: number): Attempt[] {
  return Array.from({ length: count }, (_, i) => failure(i * stepMs));
}

describe('lockedUntil', () => {
  describe('RF-15: 10 failed verifications in 24 h lock the email for 24 h', () => {
    // 10 failures, the last one at 9 h.
    const ten = failures(10, HOUR);
    const tenth = 9 * HOUR;

    it('does not lock with 9 failures', () => {
      expect(
        lockedUntil(failures(9, HOUR), VERIFICATION_LOCKOUT, at(tenth)),
      ).toBeNull();
    });

    it('locks from the tenth failure, for the next 24 h', () => {
      expect(lockedUntil(ten, VERIFICATION_LOCKOUT, at(tenth))).toEqual(
        at(tenth + 24 * HOUR),
      );
    });

    it('is still locked 1 s before the 24 h are over', () => {
      expect(
        lockedUntil(ten, VERIFICATION_LOCKOUT, at(tenth + 24 * HOUR - SECOND)),
      ).not.toBeNull();
    });

    it('is no longer locked when the 24 h are over, nor 1 s later', () => {
      expect(
        lockedUntil(ten, VERIFICATION_LOCKOUT, at(tenth + 24 * HOUR)),
      ).toBeNull();
      expect(
        lockedUntil(ten, VERIFICATION_LOCKOUT, at(tenth + 24 * HOUR + SECOND)),
      ).toBeNull();
    });

    it('counts 10 failures that fit exactly in 24 h', () => {
      const spread = failures(10, (24 * HOUR) / 9);
      expect(
        lockedUntil(spread, VERIFICATION_LOCKOUT, at(24 * HOUR)),
      ).not.toBeNull();
    });

    it('does not lock when the 10 failures span more than 24 h', () => {
      const spread = [...failures(9, HOUR), failure(24 * HOUR + SECOND)];
      expect(
        lockedUntil(spread, VERIFICATION_LOCKOUT, at(24 * HOUR + SECOND)),
      ).toBeNull();
    });

    it('accepts the attempts in any order', () => {
      expect(
        lockedUntil([...ten].reverse(), VERIFICATION_LOCKOUT, at(tenth)),
      ).toEqual(at(tenth + 24 * HOUR));
    });
  });

  describe('RF-22: 5 failed sign-ins in 15 min, with no success between them, lock for 15 min', () => {
    const five = failures(5, MINUTE);
    const fifth = 4 * MINUTE;

    it('does not lock with 4 failures', () => {
      expect(
        lockedUntil(failures(4, MINUTE), SIGN_IN_LOCKOUT, at(fifth)),
      ).toBeNull();
    });

    it('locks for the 15 min after the fifth failure', () => {
      expect(lockedUntil(five, SIGN_IN_LOCKOUT, at(fifth))).toEqual(
        at(fifth + 15 * MINUTE),
      );
      expect(
        lockedUntil(five, SIGN_IN_LOCKOUT, at(fifth + 15 * MINUTE - SECOND)),
      ).not.toBeNull();
    });

    it('is free again 15 min after the fifth failure, and 1 s later', () => {
      expect(
        lockedUntil(five, SIGN_IN_LOCKOUT, at(fifth + 15 * MINUTE)),
      ).toBeNull();
      expect(
        lockedUntil(five, SIGN_IN_LOCKOUT, at(fifth + 15 * MINUTE + SECOND)),
      ).toBeNull();
    });

    it('does not lock when the 5 failures span more than 15 min', () => {
      const spread = [...failures(4, MINUTE), failure(15 * MINUTE + SECOND)];
      expect(
        lockedUntil(spread, SIGN_IN_LOCKOUT, at(15 * MINUTE + SECOND)),
      ).toBeNull();
    });

    it('a successful sign-in between the failures resets the count', () => {
      const attempts = [
        failure(0),
        failure(MINUTE),
        failure(2 * MINUTE),
        success(3 * MINUTE),
        failure(4 * MINUTE),
        failure(5 * MINUTE),
      ];
      expect(lockedUntil(attempts, SIGN_IN_LOCKOUT, at(5 * MINUTE))).toBeNull();
    });

    it('locks with 5 failures after the last success', () => {
      const attempts = [
        success(0),
        ...failures(5, MINUTE).map((a) =>
          failure(a.at.getTime() - t0 + MINUTE),
        ),
      ];
      expect(lockedUntil(attempts, SIGN_IN_LOCKOUT, at(5 * MINUTE))).toEqual(
        at(5 * MINUTE + 15 * MINUTE),
      );
    });
  });
});

describe('countsAsFailure', () => {
  it('RF-31: an attempt rejected during the lockout does not count as a failure', () => {
    const five = failures(5, MINUTE);
    expect(countsAsFailure(five, SIGN_IN_LOCKOUT, at(10 * MINUTE))).toBe(false);
  });

  it('RF-31: so the lockout ends 15 min after the fifth failure, however many attempts came later', () => {
    const fifth = 4 * MINUTE;
    // Attempts rejected during the lockout are never recorded: the input stays the same.
    const five = failures(5, MINUTE);
    expect(lockedUntil(five, SIGN_IN_LOCKOUT, at(fifth + 14 * MINUTE))).toEqual(
      at(fifth + 15 * MINUTE),
    );
  });

  it('counts failures outside a lockout (RF-15 too, spec D16)', () => {
    expect(
      countsAsFailure(failures(4, MINUTE), SIGN_IN_LOCKOUT, at(5 * MINUTE)),
    ).toBe(true);
    expect(
      countsAsFailure(failures(9, HOUR), VERIFICATION_LOCKOUT, at(9 * HOUR)),
    ).toBe(true);
    expect(
      countsAsFailure(failures(10, HOUR), VERIFICATION_LOCKOUT, at(10 * HOUR)),
    ).toBe(false);
  });
});
