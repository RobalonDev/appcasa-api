import { Injectable } from '@nestjs/common';
import { AuthEmailJobs } from './auth-email-jobs.js';

@Injectable()
export class RegistrationService {
  constructor(private readonly jobs: AuthEmailJobs) {}

  /**
   * Queues the work and returns at once (ADR-0009): the response must not depend on
   * whether the email has an account, a limit applies or the mail is sent (RNF-2).
   */
  requestRegistration(email: string): void {
    this.jobs.enqueueRegistrationRequest(email);
  }
}
