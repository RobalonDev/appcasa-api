import { randomInt } from 'node:crypto';

const CODE_SPACE = 1_000_000;

/**
 * A fresh 6-digit verification code, leading zeros included (RF-34).
 * Uses the cryptographically secure generator by default; tests may inject another.
 */
export function generateVerificationCode(
  random: (max: number) => number = (max) => randomInt(max),
): string {
  return String(random(CODE_SPACE)).padStart(6, '0');
}
