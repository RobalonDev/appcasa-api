import { argon2, randomBytes, timingSafeEqual } from 'node:crypto';

export interface Argon2Params {
  /** Memory in KiB. */
  memory: number;
  /** Iterations. */
  passes: number;
  parallelism: number;
}

/** OWASP minimum for argon2id (ADR-0008): 19 MiB, 2 passes, 1 lane. */
export const OWASP_ARGON2ID: Argon2Params = {
  memory: 19_456,
  passes: 2,
  parallelism: 1,
};

const SALT_BYTES = 16;
const HASH_BYTES = 32;
const PHC =
  /^\$argon2id\$v=19\$m=(\d+),t=(\d+),p=(\d+)\$([A-Za-z0-9+/]+)\$([A-Za-z0-9+/]+)$/;

interface ParsedHash {
  params: Argon2Params;
  salt: Buffer;
  hash: Buffer;
}

/** PHC strings use unpadded standard base64. */
const toB64 = (bytes: Buffer) => bytes.toString('base64').replace(/=+$/, '');

function derive(
  password: string,
  salt: Buffer,
  params: Argon2Params,
  length: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    argon2(
      'argon2id',
      {
        // RF-39: canonically equivalent passwords are the same password.
        message: password.normalize('NFC'),
        nonce: salt,
        tagLength: length,
        memory: params.memory,
        passes: params.passes,
        parallelism: params.parallelism,
      },
      (error, key) => (error ? reject(error) : resolve(key)),
    );
  });
}

function parse(stored: string): ParsedHash | null {
  const match = PHC.exec(stored);
  if (!match) {
    return null;
  }
  const [, m, t, p, salt, hash] = match;
  if (!m || !t || !p || !salt || !hash) {
    return null;
  }
  return {
    params: { memory: Number(m), passes: Number(t), parallelism: Number(p) },
    salt: Buffer.from(salt, 'base64'),
    hash: Buffer.from(hash, 'base64'),
  };
}

/**
 * argon2id password hashing with Node's built-in implementation (ADR-0008).
 * Hashes are stored in PHC format with their parameters, so they can be raised later
 * and old hashes still verify (`needsRehash` tells when to replace them).
 */
export class PasswordHasher {
  /**
   * Hash compared against when the account does not exist, so timing does not tell
   * (RNF-2). Computed up front: otherwise the first such request would pay for it.
   */
  private readonly dummy: Promise<string>;

  constructor(private readonly params: Argon2Params = OWASP_ARGON2ID) {
    this.dummy = this.hash('dummy password used only for timing');
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(SALT_BYTES);
    const hash = await derive(password, salt, this.params, HASH_BYTES);
    const { memory, passes, parallelism } = this.params;
    return `$argon2id$v=19$m=${memory},t=${passes},p=${parallelism}$${toB64(salt)}$${toB64(hash)}`;
  }

  /**
   * True only when `password` matches `stored`. With `stored === null` (no such account)
   * it still runs a full verification against a dummy hash and returns false, so the
   * response takes as long as for a real account with a wrong password (RNF-2).
   * Never throws for a malformed stored value.
   */
  async verify(stored: string | null, password: string): Promise<boolean> {
    if (stored === null) {
      await this.verify(await this.dummy, password);
      return false;
    }
    const parsed = parse(stored);
    if (!parsed || parsed.hash.length === 0) {
      return false;
    }
    try {
      const candidate = await derive(
        password,
        parsed.salt,
        parsed.params,
        parsed.hash.length,
      );
      return timingSafeEqual(candidate, parsed.hash);
    } catch {
      return false;
    }
  }

  /** True when `stored` was made with other parameters and should be re-hashed on sign-in. */
  needsRehash(stored: string): boolean {
    const parsed = parse(stored);
    if (!parsed) {
      return true;
    }
    const { memory, passes, parallelism } = parsed.params;
    return (
      memory !== this.params.memory ||
      passes !== this.params.passes ||
      parallelism !== this.params.parallelism ||
      parsed.hash.length !== HASH_BYTES
    );
  }
}
