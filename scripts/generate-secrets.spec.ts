import { envSchema } from '../src/config/env.js';
import { generateSecretsEnv } from './generate-secrets.js';

/** Minimal `.env` line parser: NAME=value, one per line. */
function parseLines(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .trim()
      .split('\n')
      .map((line) => {
        const index = line.indexOf('=');
        return [line.slice(0, index), line.slice(index + 1)];
      }),
  );
}

describe('generateSecretsEnv (ADR-0008)', () => {
  it('prints one single-line NAME=value per secret', () => {
    const lines = generateSecretsEnv().trim().split('\n');
    expect(lines.map((line) => line.split('=')[0])).toEqual([
      'JWT_PRIVATE_KEY',
      'JWT_PUBLIC_KEY',
      'VERIFICATION_CODE_SECRET',
    ]);
  });

  it('produces values the env schema accepts', () => {
    const generated = parseLines(generateSecretsEnv());
    expect(() =>
      envSchema.parse({
        ...generated,
        DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
        SMTP_URL: 'smtp://localhost:1025',
        MAIL_FROM: 'AppCasa <no-reply@appcasa.local>',
      }),
    ).not.toThrow();
  });

  it('generates different secrets each time', () => {
    expect(generateSecretsEnv()).not.toBe(generateSecretsEnv());
  });
});
