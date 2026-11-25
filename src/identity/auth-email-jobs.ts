import {
  type BeforeApplicationShutdown,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BoundedJobQueue } from './bounded-job-queue.js';
import { RegistrationEmailJob } from './registration-email.job.js';

/**
 * Port for the background work that sends authentication emails (ADR-0009).
 * Phase 5 replaces the in-memory implementation with an outbox or a queue.
 */
export abstract class AuthEmailJobs {
  /** Queues the work of a registration request; never waits for it. */
  abstract enqueueRegistrationRequest(email: string): void;
  /** Resolves once all queued work is done (tests, shutdown). */
  abstract drain(): Promise<void>;
}

/** Plan 001 / ADR-0013: ~4 sends at a time, ~1,000 waiting. */
const CONCURRENCY = 4;
const CAPACITY = 1_000;

@Injectable()
export class InMemoryAuthEmailJobs
  extends AuthEmailJobs
  implements BeforeApplicationShutdown
{
  private readonly logger = new Logger(InMemoryAuthEmailJobs.name);
  private readonly queue = new BoundedJobQueue({
    concurrency: CONCURRENCY,
    capacity: CAPACITY,
    onError: (error) =>
      this.logger.error(
        'Authentication email job failed',
        error instanceof Error ? error.stack : String(error),
      ),
  });

  constructor(private readonly registrationEmail: RegistrationEmailJob) {
    super();
  }

  enqueueRegistrationRequest(email: string): void {
    const queued = this.queue.push(() => this.registrationEmail.run(email));
    if (!queued) {
      // Dropped like a failed send: the response was already identical (RNF-2).
      this.logger.warn('Authentication email queue full: request dropped');
    }
  }

  drain(): Promise<void> {
    return this.queue.drain();
  }

  /** Lets queued emails finish before Prisma disconnects (`onApplicationShutdown`). */
  async beforeApplicationShutdown(): Promise<void> {
    await this.drain();
  }
}
