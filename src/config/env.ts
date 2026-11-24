import { createPrivateKey, createPublicKey, type KeyObject } from 'node:crypto';
import { z } from 'zod';

/**
 * PEM keys are multi-line; in `.env` files and CI variables they are written on one
 * line with literal `\n`. Both forms are accepted and normalised to real newlines.
 */
const pem = z.string().transform((value) => value.replaceAll('\\n', '\n'));

function parseKey(
  value: string,
  read: (pem: string) => KeyObject,
): KeyObject | undefined {
  try {
    return read(value);
  } catch {
    return undefined;
  }
}

/** Ed25519 key of the given kind (ADR-0008: access tokens are signed with EdDSA). */
function ed25519(kind: 'private' | 'public') {
  return pem.refine(
    (value) => {
      // `createPublicKey` also accepts a private PEM (it derives the public half):
      // reject it, so secret material never ends up in the shareable public variable.
      if (kind === 'public' && parseKey(value, createPrivateKey)) {
        return false;
      }
      const key = parseKey(
        value,
        kind === 'private' ? createPrivateKey : createPublicKey,
      );
      return key?.type === kind && key.asymmetricKeyType === 'ed25519';
    },
    { error: `must be an Ed25519 ${kind} key in PEM format` },
  );
}

/** True when `publicPem` is the public half of `privatePem`. */
function isKeyPair(privatePem: string, publicPem: string): boolean {
  const derived = parseKey(privatePem, createPublicKey);
  const given = parseKey(publicPem, createPublicKey);
  return derived !== undefined && given !== undefined && derived.equals(given);
}

/**
 * Single source of truth for environment variables.
 * Validated once at bootstrap: if anything is missing or malformed the app refuses to start
 * (fail fast) instead of failing later in the middle of a request.
 */
export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'test', 'production'])
      .default('development'),
    PORT: z.coerce.number().int().min(1).max(65535).default(3000),
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),

    // Access-token signing keys (ADR-0008). Generate them with `pnpm keys:generate`.
    JWT_PRIVATE_KEY: ed25519('private'),
    JWT_PUBLIC_KEY: ed25519('public'),
    // Key of the HMAC that stores verification codes (plan 001, data model).
    VERIFICATION_CODE_SECRET: z.string().min(32),

    // Authentication emails (ADR-0009). Locally, Mailpit: smtp://localhost:1025.
    SMTP_URL: z.url({ protocol: /^smtps?$/ }),
    MAIL_FROM: z.string().trim().min(1),
  })
  .refine((env) => isKeyPair(env.JWT_PRIVATE_KEY, env.JWT_PUBLIC_KEY), {
    error: 'JWT_PUBLIC_KEY must be the public key of JWT_PRIVATE_KEY',
    path: ['JWT_PUBLIC_KEY'],
  });

export type Env = z.infer<typeof envSchema>;
