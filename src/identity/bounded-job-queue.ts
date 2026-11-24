export interface BoundedJobQueueOptions {
  /** Most jobs running at the same time. */
  concurrency: number;
  /** Most jobs waiting to start; beyond it, new jobs are dropped. */
  capacity: number;
  /** Called with the error of a failed job; the queue keeps going. */
  onError?: (error: unknown) => void;
}

type Job = () => Promise<void>;

/**
 * In-process work queue with bounded concurrency and a bounded backlog (ADR-0013).
 * Jobs start after the caller's synchronous code, so an HTTP handler can answer first.
 * Nothing survives a restart: that is accepted in ADR-0009 until phase 5.
 */
export class BoundedJobQueue {
  private readonly waiting: Job[] = [];
  private running = 0;
  private idleWaiters: (() => void)[] = [];

  constructor(private readonly options: BoundedJobQueueOptions) {}

  /** Queues a job; false (and the job is dropped) when the backlog is full. */
  push(job: Job): boolean {
    if (this.waiting.length >= this.options.capacity) {
      return false;
    }
    this.waiting.push(job);
    queueMicrotask(() => this.pump());
    return true;
  }

  /** Resolves once nothing is running or waiting, including jobs queued meanwhile. */
  drain(): Promise<void> {
    if (this.isIdle()) {
      return Promise.resolve();
    }
    return new Promise((resolve) => this.idleWaiters.push(resolve));
  }

  private isIdle(): boolean {
    return this.running === 0 && this.waiting.length === 0;
  }

  private pump(): void {
    while (this.running < this.options.concurrency) {
      const job = this.waiting.shift();
      if (!job) {
        break;
      }
      this.running++;
      void this.run(job);
    }
    if (this.isIdle()) {
      const waiters = this.idleWaiters;
      this.idleWaiters = [];
      waiters.forEach((resolve) => resolve());
    }
  }

  private async run(job: Job): Promise<void> {
    try {
      await job();
    } catch (error) {
      this.options.onError?.(error);
    } finally {
      this.running--;
      this.pump();
    }
  }
}
