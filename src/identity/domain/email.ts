import { z } from 'zod';
import { countCharacters, trimWhiteSpace } from './text.js';

/** RF-35: longest accepted email, counted without the surrounding whitespace. */
export const MAX_EMAIL_LENGTH = 254;

/**
 * Zod's default email pattern (plan 001, decision E2): ASCII only, a dot in the domain,
 * no quoted local parts or IP literals; internationalised domains only in punycode,
 * except the top-level one.
 */
const emailFormat = z.email();

/**
 * Normalised email, or `null` when it is not a valid email (RF-35).
 * Order (plan «Normalización»): trim White_Space → length ≤ 254 → format → lowercase.
 * Since only ASCII passes the format check, lowercasing has no locale edge cases (RF-26).
 */
export function normalizeEmail(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const trimmed = trimWhiteSpace(input);
  if (countCharacters(trimmed) > MAX_EMAIL_LENGTH) {
    return null;
  }
  if (!emailFormat.safeParse(trimmed).success) {
    return null;
  }
  return trimmed.toLowerCase();
}

/**
 * Schema for an `email` field: outputs the normalised email or fails with the
 * `INVALID_EMAIL` code (plan 001, API contract). Missing values fail too (RF-35).
 */
export const emailSchema = z.unknown().transform((input, ctx) => {
  const email = normalizeEmail(input);
  if (email === null) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_EMAIL' });
    return z.NEVER;
  }
  return email;
});
