import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

/**
 * The list shipped with the app (plan 001, decision E1): one password per line, NFC,
 * 12–128 characters. Regenerate it with `node scripts/build-leaked-passwords.ts`.
 * `nest build` copies it next to the compiled code (nest-cli.json, assets).
 */
export const BUNDLED_LIST = join(
  import.meta.dirname,
  '../data/leaked-passwords.txt',
);

/**
 * Known leaked passwords, held in memory so the check never depends on an external
 * service and is always available (RNF-5). Exact match after NFC (RF-39).
 */
export class LeakedPasswords {
  private readonly passwords: Set<string>;

  constructor(passwords: Iterable<string>) {
    this.passwords = new Set(
      Array.from(passwords, (password) => password.normalize('NFC')),
    );
  }

  static async fromFile(path: string): Promise<LeakedPasswords> {
    const text = await readFile(path, 'utf8');
    return new LeakedPasswords(text.split('\n').filter((line) => line !== ''));
  }

  get size(): number {
    return this.passwords.size;
  }

  has(password: string): boolean {
    return this.passwords.has(password.normalize('NFC'));
  }
}
