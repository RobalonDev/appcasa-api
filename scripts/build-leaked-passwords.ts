/**
 * Regenerates the leaked-password list bundled with the app (RF-24, RNF-5; plan 001,
 * decision E1):
 *
 *   node scripts/build-leaked-passwords.ts
 *
 * Source: SecLists (MIT), top one million passwords from leaks, pinned to a commit so
 * the output is reproducible. To refresh it, bump SOURCE_COMMIT and run the script.
 * Only passwords of 12 to 128 characters are kept: RF-23 already rejects the rest.
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const SOURCE_COMMIT = '12274c98fdebe98c7a7284914436a472ed469aed';
const SOURCE_URL = `https://raw.githubusercontent.com/danielmiessler/SecLists/${SOURCE_COMMIT}/Passwords/Common-Credentials/Pwdb_top-1000000.txt`;
const OUTPUT = join(
  import.meta.dirname,
  '../src/identity/data/leaked-passwords.txt',
);

const MIN_LENGTH = 12;
const MAX_LENGTH = 128;

/** NFC, 12–128 characters (code points after NFC, as RF-23 counts), unique, in order. */
export function filterLeakedPasswords(lines: readonly string[]): string[] {
  const kept = new Set<string>();
  for (const line of lines) {
    const password = line.replace(/\r$/, '').normalize('NFC');
    // Code points on purpose: that is what the spec counts as «carácter».
    // oxlint-disable-next-line typescript/no-misused-spread
    const length = [...password].length;
    if (length >= MIN_LENGTH && length <= MAX_LENGTH) {
      kept.add(password);
    }
  }
  return [...kept];
}

async function main(): Promise<void> {
  const response = await fetch(SOURCE_URL);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${SOURCE_URL}`);
  }
  const passwords = filterLeakedPasswords((await response.text()).split('\n'));
  await writeFile(OUTPUT, `${passwords.join('\n')}\n`, 'utf8');
  process.stdout.write(`Wrote ${passwords.length} passwords to ${OUTPUT}\n`);
}

if (import.meta.main) {
  await main();
}
