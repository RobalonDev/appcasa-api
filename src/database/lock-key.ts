import type { Prisma } from '../generated/prisma/client.js';

/**
 * Serialises every transaction that works on the same key (ADR-0010).
 *
 * Takes a Postgres transaction-level advisory lock on `namespace:key`: a second
 * transaction asking for the same lock waits until the first commits or rolls back,
 * and then sees its writes. Different keys never block each other.
 *
 * Must be called inside an interactive transaction (`prisma.$transaction(async (tx) => …)`):
 * the lock is released when that transaction ends, never earlier.
 */
export async function lockKey(
  tx: Prisma.TransactionClient,
  namespace: string,
  key: string,
): Promise<void> {
  // hashtextextended maps the text key to the 64-bit integer advisory locks use.
  // $executeRaw rather than $queryRaw: pg_advisory_xact_lock returns `void`,
  // a column type the client has no need to read back.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`${namespace}:${key}`}, 0))`;
}
