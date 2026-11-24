import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ProblemException, toProblem, validationProblem } from './problem.js';

describe('toProblem (ADR-0011)', () => {
  it('renders a ProblemException with its stable code and extensions', () => {
    const problem = toProblem(
      new ProblemException({
        status: 400,
        code: 'VALIDATION_FAILED',
        errors: [{ field: 'email', code: 'INVALID_EMAIL' }],
      }),
    );

    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'email', code: 'INVALID_EMAIL' }],
    });
  });

  it('keeps an explicit detail', () => {
    const problem = toProblem(
      new ProblemException({
        status: 401,
        code: 'AUTHENTICATION_REQUIRED',
        detail: 'Sign in to continue.',
      }),
    );

    expect(problem).toMatchObject({
      status: 401,
      title: 'Unauthorized',
      code: 'AUTHENTICATION_REQUIRED',
      detail: 'Sign in to continue.',
    });
    expect(problem).not.toHaveProperty('errors');
  });

  it('derives the code of a plain Nest HttpException from its status', () => {
    expect(toProblem(new NotFoundException('Cannot GET /nope'))).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
      code: 'NOT_FOUND',
      detail: 'Cannot GET /nope',
    });
  });

  it('does not leak the message of a 5xx HttpException', () => {
    const problem = toProblem(
      new ServiceUnavailableException('database host db-1 is down'),
    );

    expect(problem).toEqual({
      type: 'about:blank',
      title: 'Service Unavailable',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
    });
  });

  it('turns an unknown error into a 500 without details', () => {
    expect(toProblem(new Error('secret stack info'))).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  it('turns a malformed JSON body into VALIDATION_FAILED', () => {
    // Express' JSON body parser throws this SyntaxError; Nest's Express adapter
    // wraps it in a BadRequestException and keeps it as the cause.
    const parseError = Object.assign(new SyntaxError('Unexpected token'), {
      status: 400,
      type: 'entity.parse.failed',
    });
    const wrapped = new BadRequestException(parseError.message, {
      cause: parseError,
    });

    expect(toProblem(wrapped)).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'VALIDATION_FAILED',
      errors: [{ field: 'body', code: 'INVALID_FIELD' }],
    });
  });

  it('treats a plain BadRequestException as a generic 400', () => {
    expect(toProblem(new BadRequestException('nope'))).toMatchObject({
      status: 400,
      code: 'BAD_REQUEST',
    });
  });
});

describe('validationProblem (ADR-0011)', () => {
  it('maps schema issues to { field, code }, using the message as code when it is one', () => {
    const exception = validationProblem([
      { message: 'INVALID_EMAIL', path: ['email'] },
      { message: 'Expected string, received number', path: ['password'] },
      { message: 'INVALID_FIELD', path: [{ key: 'items' }, { key: 0 }] },
      { message: 'Required' },
    ]);

    expect(toProblem(exception)).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      code: 'VALIDATION_FAILED',
      errors: [
        { field: 'email', code: 'INVALID_EMAIL' },
        { field: 'password', code: 'INVALID_FIELD' },
        { field: 'items.0', code: 'INVALID_FIELD' },
        { field: 'body', code: 'INVALID_FIELD' },
      ],
    });
  });
});
