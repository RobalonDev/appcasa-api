import { setTimeout as sleep } from 'node:timers/promises';
import { lockKey } from '../../src/database/lock-key.js';
import {
  createTestApp,
  type TestApp,
  uniqueEmail,
} from '../support/test-app.js';

// ADR-0010: per-key advisory lock, held until the transaction ends.
describe('lockKey (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  });

  afterAll(async () => {
    await t.app.close();
  });

  /**
   * Runs a transaction that takes the lock, records when it got it,
   * holds it for `holdMs` and records when it finished.
   */
  async function lockedTransaction(
    namespace: string,
    key: string,
    holdMs: number,
  ) {
    return t.prisma.$transaction(async (tx) => {
      await lockKey(tx, namespace, key);
      const acquiredAt = performance.now();
      await sleep(holdMs);
      return { acquiredAt, releasedAt: performance.now() };
    });
  }

  it('serialises two transactions that lock the same key', async () => {
    const key = uniqueEmail();
    const first = lockedTransaction('test', key, 300);
    await sleep(50); // let the first one take the lock
    const second = lockedTransaction('test', key, 0);

    const [a, b] = await Promise.all([first, second]);
    expect(b.acquiredAt).toBeGreaterThanOrEqual(a.releasedAt);
  });

  it('does not block transactions that lock different keys', async () => {
    const first = lockedTransaction('test', uniqueEmail(), 300);
    await sleep(50);
    const second = lockedTransaction('test', uniqueEmail(), 0);

    const [a, b] = await Promise.all([first, second]);
    expect(b.acquiredAt).toBeLessThan(a.releasedAt);
  });

  it('treats the same key in different namespaces as different locks', async () => {
    const key = uniqueEmail();
    const first = lockedTransaction('one', key, 300);
    await sleep(50);
    const second = lockedTransaction('two', key, 0);

    const [a, b] = await Promise.all([first, second]);
    expect(b.acquiredAt).toBeLessThan(a.releasedAt);
  });

  it('releases the lock when the transaction rolls back', async () => {
    const key = uniqueEmail();
    await expect(
      t.prisma.$transaction(async (tx) => {
        await lockKey(tx, 'test', key);
        throw new Error('rollback');
      }),
    ).rejects.toThrow('rollback');

    const start = performance.now();
    await lockedTransaction('test', key, 0);
    expect(performance.now() - start).toBeLessThan(200);
  });
});
