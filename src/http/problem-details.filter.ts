import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { toProblem } from './problem.js';

/**
 * Global filter: every error leaves the API as `application/problem+json` (ADR-0011).
 * Unexpected errors are logged here, because their details never reach the client.
 */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const body = toProblem(exception);
    if (body.status >= 500) {
      this.logger.error(
        'Unhandled error while processing a request',
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(body.status)
      .type('application/problem+json')
      .json(body);
  }
}
