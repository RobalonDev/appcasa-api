/**
 * Text rules shared by the email and the display name (spec 001, plan «Normalización»).
 */

const SURROUNDING_WHITE_SPACE = /^\p{White_Space}+|\p{White_Space}+$/gu;

/**
 * Removes «espacios en blanco de cualquier tipo» at both ends: characters with the
 * Unicode White_Space property. Not `String.prototype.trim()`, which also strips
 * U+FEFF, a format character that RF-27 rejects instead.
 */
export function trimWhiteSpace(text: string): string {
  return text.replace(SURROUNDING_WHITE_SPACE, '');
}

/**
 * Length as the spec defines «carácter»: Unicode code points after NFC normalisation.
 * A decomposed accented letter counts as one; some emojis count as several.
 */
export function countCharacters(text: string): number {
  // Code points on purpose, not graphemes (Intl.Segmenter): that is what the spec counts.
  // oxlint-disable-next-line typescript/no-misused-spread
  return [...text.normalize('NFC')].length;
}
