import type { LeakedPasswords } from './leaked-passwords.js';
import { countCharacters } from './text.js';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_PASSWORD_LENGTH = 128;

export type PasswordProblem = 'INVALID_PASSWORD_LENGTH' | 'BREACHED_PASSWORD';

/**
 * Why a password cannot be used to register, or `null` if it can (plan «Normalización»):
 * never trimmed, any character and no composition rules (RF-25), 12–128 characters
 * after NFC (RF-23), not a leaked password (RF-24), with canonically equivalent texts
 * treated as the same password (RF-39). A missing value has 0 characters (plan Q3).
 */
export function checkPassword(
  password: unknown,
  leaked: LeakedPasswords,
): PasswordProblem | null {
  const text = typeof password === 'string' ? password : '';
  const length = countCharacters(text);
  if (length < MIN_PASSWORD_LENGTH || length > MAX_PASSWORD_LENGTH) {
    return 'INVALID_PASSWORD_LENGTH';
  }
  if (leaked.has(text)) {
    return 'BREACHED_PASSWORD';
  }
  return null;
}
