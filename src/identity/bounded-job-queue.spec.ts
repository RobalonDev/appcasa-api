import { setTimeout as sleep } from 'node:timers/promises';
import { BoundedJobQueue } from './bounded-job-queue.js';

/** A job that waits until released, recording when it starts and ends. */
function gatedJob(log: string[], name: string) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  const job = async () => {
    log.push(`start ${name}`);
    await gate;
    log.push(`end ${name}`);
  };
  return { job, release };
}

describe('BoundedJobQueue (ADR-0013)', () => {
  it('runs a pushed job after the caller continues', async () => {
    const queue = new BoundedJobQueue({ concurrency: 1, capacity: 10 });
    const log: string[] = [];
    expect(queue.push(async () => void log.push('ran'))).toBe(true);
    log.push('caller');
    await queue.drain();
    expect(log).toEqual(['caller', 'ran']);
  });

  it('never runs more jobs at once than its concurrency', async () => {
    const queue = new BoundedJobQueue({ concurrency: 2, capacity: 10 });
    const log: string[] = [];
    const a = gatedJob(log, 'a');
    const b = gatedJob(log, 'b');
    const c = gatedJob(log, 'c');
    queue.push(a.job);
    queue.push(b.job);
    queue.push(c.job);

    await sleep(10);
    expect(log).toEqual(['start a', 'start b']);

    a.release();
    await sleep(10);
    expect(log).toContain('start c');

    b.release();
    c.release();
    await queue.drain();
  });

  it('drops jobs beyond its capacity of waiting jobs and says so', async () => {
    const queue = new BoundedJobQueue({ concurrency: 1, capacity: 2 });
    const log: string[] = [];
    const running = gatedJob(log, 'running');
    queue.push(running.job);
    await sleep(0);

    expect(queue.push(async () => void log.push('w1'))).toBe(true);
    expect(queue.push(async () => void log.push('w2'))).toBe(true);
    expect(queue.push(async () => void log.push('dropped'))).toBe(false);

    running.release();
    await queue.drain();
    expect(log).not.toContain('dropped');
    expect(log).toContain('w2');
  });

  it('keeps going when a job fails, reporting the error', async () => {
    const errors: unknown[] = [];
    const queue = new BoundedJobQueue({
      concurrency: 1,
      capacity: 10,
      onError: (error) => errors.push(error),
    });
    const log: string[] = [];
    queue.push(() => Promise.reject(new Error('boom')));
    queue.push(async () => void log.push('next'));

    await queue.drain();
    expect(errors).toHaveLength(1);
    expect(log).toEqual(['next']);
  });

  it('drain resolves at once when idle, and waits for jobs pushed by jobs', async () => {
    const queue = new BoundedJobQueue({ concurrency: 1, capacity: 10 });
    await queue.drain();

    const log: string[] = [];
    queue.push(async () => {
      log.push('first');
      queue.push(async () => void log.push('second'));
    });
    await queue.drain();
    expect(log).toEqual(['first', 'second']);
  });
});
