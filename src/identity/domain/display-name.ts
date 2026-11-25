import { z } from 'zod';
import { countCharacters, trimWhiteSpace } from './text.js';

export const MIN_DISPLAY_NAME_LENGTH = 2;
export const MAX_DISPLAY_NAME_LENGTH = 30;

/**
 * RF-27: control (Cc), format (Cf, e.g. zero-width space), line (Zl) and paragraph
 * (Zp) separators, private use (Co) and unassigned (Cn) code points.
 */
const FORBIDDEN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\p{Co}\p{Cn}]/u;

/**
 * The display name as stored, or `null` if it is not valid (RF-27, plan «Normalización»):
 * whitespace at both ends removed (so a tab there is dropped, while one inside is a
 * control character and is rejected), NFC, 2–30 characters, no forbidden characters.
 */
export function normalizeDisplayName(input: unknown): string | null {
  if (typeof input !== 'string') {
    return null;
  }
  const name = trimWhiteSpace(input).normalize('NFC');
  const length = countCharacters(name);
  if (length < MIN_DISPLAY_NAME_LENGTH || length > MAX_DISPLAY_NAME_LENGTH) {
    return null;
  }
  return FORBIDDEN.test(name) ? null : name;
}

/** Schema for a `displayName` field: the stored form, or `INVALID_DISPLAY_NAME`. */
export const displayNameSchema = z.unknown().transform((input, ctx) => {
  const name = normalizeDisplayName(input);
  if (name === null) {
    ctx.addIssue({ code: 'custom', message: 'INVALID_DISPLAY_NAME' });
    return z.NEVER;
  }
  return name;
});
