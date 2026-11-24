/**
 * Prints fresh secrets for the authentication module as `.env` lines:
 * an Ed25519 key pair for access tokens (ADR-0008) and the verification-code HMAC key.
 *
 *   pnpm keys:generate            # copy the output into .env
 *   node scripts/generate-secrets.ts >> "$GITHUB_ENV"   # CI
 *
 * Values are unquoted and on one line (newlines as literal `\n`), so the same output
 * works for dotenv and for GitHub Actions' environment file.
 */
import { generateKeyPairSync, randomBytes } from 'node:crypto';

export function generateSecretsEnv(): string {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const oneLine = (pem: string) => pem.trim().replaceAll('\n', '\\n');

  return [
    `JWT_PRIVATE_KEY=${oneLine(privateKey)}`,
    `JWT_PUBLIC_KEY=${oneLine(publicKey)}`,
    `VERIFICATION_CODE_SECRET=${randomBytes(32).toString('base64url')}`,
  ].join('\n');
}

if (import.meta.main) {
  process.stdout.write(`${generateSecretsEnv()}\n`);
}
