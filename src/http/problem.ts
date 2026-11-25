import { STATUS_CODES } from 'node:http';
import {
  HttpException,
  HttpStatus,
  type StandardSchemaValidationPipeOptions,
} from '@nestjs/common';

/** A validation issue as the Standard Schema pipe hands it to `exceptionFactory`. */
type SchemaIssue = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0][number];

/** One entry of `errors[]` in a validation problem: which field failed and why. */
export interface FieldError {
  field: string;
  code: string;
}

/**
 * Error response body, RFC 9457 (Problem Details) plus our extensions (ADR-0011):
 * `code` is the stable, machine-readable identifier clients rely on;
 * `errors` lists per-field failures of a validation problem.
 */
export interface ProblemBody {
  type: string;
  title: string;
  status: number;
  code: string;
  detail?: string;
  errors?: FieldError[];
}

export interface ProblemInit {
  status: number;
  code: string;
  detail?: string;
  errors?: FieldError[];
}

/** An HTTP error that already carries its stable `code` (and, optionally, field errors). */
export class ProblemException extends HttpException {
  readonly code: string;
  readonly detail: string | undefined;
  readonly errors: FieldError[] | undefined;

  constructor({ status, code, detail, errors }: ProblemInit) {
    super(detail ?? code, status);
    this.code = code;
    this.detail = detail;
    this.errors = errors;
  }
}

const CODE_PATTERN = /^[A-Z][A-Z0-9_]*$/;

function titleFor(status: number): string {
  return STATUS_CODES[status] ?? 'Error';
}

function codeFor(status: number): string {
  const name: unknown = HttpStatus[status];
  return typeof name === 'string' ? name : 'HTTP_ERROR';
}

function problem(init: ProblemInit): ProblemBody {
  return {
    type: 'about:blank',
    title: titleFor(init.status),
    status: init.status,
    code: init.code,
    ...(init.detail === undefined ? {} : { detail: init.detail }),
    ...(init.errors === undefined ? {} : { errors: init.errors }),
  };
}

/**
 * Express' JSON body parser rejects malformed bodies before any route runs; Nest's
 * Express adapter wraps that error in a BadRequestException and keeps it as `cause`.
 */
function isBodyParseError(error: HttpException): boolean {
  const cause: unknown = error.cause;
  return (
    cause instanceof Error &&
    'type' in cause &&
    cause.type === 'entity.parse.failed'
  );
}

/**
 * Converts anything thrown while handling a request into a Problem Details body.
 * Server errors (5xx) never expose their message: it may contain internal details.
 */
export function toProblem(error: unknown): ProblemBody {
  if (error instanceof ProblemException) {
    return problem({
      status: error.getStatus(),
      code: error.code,
      detail: error.detail,
      errors: error.errors,
    });
  }

  if (error instanceof HttpException) {
    if (isBodyParseError(error)) {
      return problem({
        status: HttpStatus.BAD_REQUEST,
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'body', code: 'INVALID_FIELD' }],
      });
    }
    const status = error.getStatus();
    return problem({
      status,
      code: codeFor(status),
      detail: status < 500 ? error.message : undefined,
    });
  }

  return problem({
    status: HttpStatus.INTERNAL_SERVER_ERROR,
    code: 'INTERNAL_SERVER_ERROR',
  });
}

function fieldOf(issue: SchemaIssue): string {
  if (!issue.path || issue.path.length === 0) {
    return 'body';
  }
  return issue.path
    .map((segment) =>
      typeof segment === 'object' ? String(segment.key) : String(segment),
    )
    .join('.');
}

/**
 * `exceptionFactory` for the validation pipe. Schemas declare the error code as the
 * issue message (e.g. `z.string({ error: 'INVALID_EMAIL' })`); any other message,
 * such as a library default, becomes the generic `INVALID_FIELD`.
 */
export function validationProblem(
  issues: readonly SchemaIssue[],
): ProblemException {
  return new ProblemException({
    status: HttpStatus.BAD_REQUEST,
    code: 'VALIDATION_FAILED',
    errors: issues.map((issue) => ({
      field: fieldOf(issue),
      code: CODE_PATTERN.test(issue.message) ? issue.message : 'INVALID_FIELD',
    })),
  });
}
