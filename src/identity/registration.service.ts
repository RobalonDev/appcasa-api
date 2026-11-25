import { HttpStatus, Injectable } from '@nestjs/common';
import { Clock } from '../clock/clock.js';
import { lockKey } from '../database/lock-key.js';
import { PrismaService } from '../database/prisma.service.js';
import type { Prisma } from '../generated/prisma/client.js';
import { type FieldError, ProblemException } from '../http/problem.js';
import { AuthEmailJobs } from './auth-email-jobs.js';
import { PasswordHasher } from './crypto/password-hasher.js';
import { TokensService } from './crypto/tokens.service.js';
import { normalizeDisplayName } from './domain/display-name.js';
import { normalizeEmail } from './domain/email.js';
import { LeakedPasswords } from './domain/leaked-passwords.js';
import { checkPassword } from './domain/password-policy.js';
import { EMAIL_LOCK } from './email-lock.js';
import { isVerificationLocked } from './verification-lock.js';

/** RF-9: a code stops working when more than 15 minutes have passed since it was issued. */
const CODE_TTL_MS = 15 * 60_000;
/** RF-10: failed attempts that invalidate a code. */
const MAX_CODE_FAILURES = 5;

/** Fields of a «complete registration» request once they passed validation. */
interface RegistrationData {
  email: string;
  displayName: string;
  password: string;
  /** Only a text value is a code that was entered (plan Q3). */
  code: string | null;
}

type CompletionResult = { kind: 'created' } | { kind: 'invalid-code' };

function validationFailed(errors: FieldError[]): ProblemException {
  return new ProblemException({
    status: HttpStatus.BAD_REQUEST,
    code: 'VALIDATION_FAILED',
    errors,
  });
}

/** RF-16: the same answer for every reason a code does not complete a registration. */
function invalidVerificationCode(): ProblemException {
  return new ProblemException({
    status: HttpStatus.BAD_REQUEST,
    code: 'INVALID_VERIFICATION_CODE',
  });
}

function field(body: unknown, name: string): unknown {
  return typeof body === 'object' && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>)[name]
    : undefined;
}

@Injectable()
export class RegistrationService {
  constructor(
    private readonly jobs: AuthEmailJobs,
    private readonly prisma: PrismaService,
    private readonly clock: Clock,
    private readonly leaked: LeakedPasswords,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokensService,
  ) {}

  /**
   * Queues the work and returns at once (ADR-0009): the response must not depend on
   * whether the email has an account, a limit applies or the mail is sent (RNF-2).
   */
  requestRegistration(email: string): void {
    this.jobs.enqueueRegistrationRequest(email);
  }

  /**
   * Step 2 of registration (plan «Completar el registro»). The raw body is validated
   * here rather than by a schema, in the order RF-37 requires, mapping every problem
   * to an error of the spec (plan Q3). Nothing is thrown inside the transaction:
   * the failure counters it writes must be committed (plan, «Flujos y consistencia»).
   */
  async completeRegistration(body: unknown): Promise<void> {
    const data = this.validate(body);
    const result = await this.prisma.$transaction(
      (tx) => this.evaluate(tx, data),
      { timeout: 15_000 },
    );
    if (result.kind === 'invalid-code') {
      throw invalidVerificationCode();
    }
  }

  /** RF-37: email first; then display name and password together (RF-27, RF-23, RF-24). */
  private validate(body: unknown): RegistrationData {
    const email = normalizeEmail(field(body, 'email'));
    if (email === null) {
      throw validationFailed([{ field: 'email', code: 'INVALID_EMAIL' }]);
    }

    const errors: FieldError[] = [];
    const displayName = normalizeDisplayName(field(body, 'displayName'));
    if (displayName === null) {
      errors.push({ field: 'displayName', code: 'INVALID_DISPLAY_NAME' });
    }
    const password = field(body, 'password');
    const passwordProblem = checkPassword(password, this.leaked);
    if (passwordProblem !== null) {
      errors.push({ field: 'password', code: passwordProblem });
    }
    // RF-28: invalid data is rejected before the code is even looked at.
    if (
      errors.length > 0 ||
      displayName === null ||
      typeof password !== 'string'
    ) {
      throw validationFailed(errors);
    }

    const code = field(body, 'code');
    return {
      email,
      displayName,
      password,
      code: typeof code === 'string' ? code : null,
    };
  }

  /** Under the email lock (ADR-0010), so concurrent attempts are counted exactly (RNF-3). */
  private async evaluate(
    tx: Prisma.TransactionClient,
    data: RegistrationData,
  ): Promise<CompletionResult> {
    await lockKey(tx, EMAIL_LOCK, data.email);
    const now = this.clock.now();
    const invalid = { kind: 'invalid-code' } as const;

    // RF-15: locked → every code is rejected, and the attempt does not count.
    if (await isVerificationLocked(tx, data.email, now)) {
      return invalid;
    }
    // RF-41: an email that already has an account: nothing is created, nothing counts.
    if ((await tx.user.count({ where: { email: data.email } })) > 0) {
      return invalid;
    }
    // No registration in progress (no valid code): nothing counts (spec D16).
    const active = await tx.verificationCode.findFirst({
      where: { email: data.email, status: 'ACTIVE' },
    });
    if (
      !active?.issuedAt ||
      now.getTime() - active.issuedAt.getTime() > CODE_TTL_MS
    ) {
      return invalid;
    }
    // A code that is not text was not entered: generic answer, no failure (plan Q3).
    if (data.code === null) {
      return invalid;
    }

    if (
      !this.tokens.verificationCodeMatches(
        active.codeHmac,
        data.email,
        data.code,
      )
    ) {
      const failedAttempts = active.failedAttempts + 1;
      await tx.verificationCode.update({
        where: { id: active.id },
        data: {
          failedAttempts,
          // RF-10: the fifth failure invalidates the code.
          ...(failedAttempts >= MAX_CODE_FAILURES
            ? { status: 'INVALIDATED' }
            : {}),
        },
      });
      // RF-15: every failure of this email counts towards the 24-hour cap.
      await tx.verificationFailure.create({
        data: { email: data.email, failedAt: now },
      });
      return invalid;
    }

    await tx.user.create({
      data: {
        email: data.email,
        displayName: data.displayName,
        passwordHash: await this.hasher.hash(data.password),
        createdAt: now,
      },
    });
    return { kind: 'created' };
  }
}
