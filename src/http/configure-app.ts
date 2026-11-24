import {
  type INestApplication,
  StandardSchemaValidationPipe,
} from '@nestjs/common';
import { ProblemDetailsFilter } from './problem-details.filter.js';
import { validationProblem } from './problem.js';

/**
 * App-wide HTTP setup shared by `main.ts` and every e2e test (ADR-0012), so tests
 * exercise the same validation and error format as production (ADR-0011).
 */
export function configureApp(app: INestApplication): void {
  app.useGlobalPipes(
    new StandardSchemaValidationPipe({ exceptionFactory: validationProblem }),
  );
  app.useGlobalFilters(new ProblemDetailsFilter());
}
