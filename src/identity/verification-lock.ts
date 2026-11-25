import type { Prisma } from '../generated/prisma/client.js';
import { lockedUntil, VERIFICATION_LOCKOUT } from './domain/attempt-window.js';

/**
 * RF-15: whether too many failed verifications currently lock this email's codes.
 * Used when requesting a registration (RF-42) and when completing one.
 */
export async function isVerificationLocked(
  tx: Prisma.TransactionClient,
  email: string,
  now: Date,
): Promise<boolean> {
  const lookback = VERIFICATION_LOCKOUT.windowMs + VERIFICATION_LOCKOUT.lockMs;
  const failures = await tx.verificationFailure.findMany({
    where: { email, failedAt: { gt: new Date(now.getTime() - lookback) } },
    select: { failedAt: true },
  });
  const attempts = failures.map((f) => ({
    at: f.failedAt,
    outcome: 'FAILURE' as const,
  }));
  return lockedUntil(attempts, VERIFICATION_LOCKOUT, now) !== null;
}
