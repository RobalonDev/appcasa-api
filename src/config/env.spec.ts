import { generateKeyPairSync } from 'node:crypto';
import { envSchema } from './env.js';

/** Ed25519 key pair as single-line PEM with literal `\n`, as written in `.env`. */
function ed25519Pair() {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519', {
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  });
  const escape = (pem: string) => pem.replaceAll('\n', '\\n');
  return {
    privateKey,
    publicKey,
    escaped: { privateKey: escape(privateKey), publicKey: escape(publicKey) },
  };
}

describe('envSchema', () => {
  const pair = ed25519Pair();
  const valid = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
    JWT_PRIVATE_KEY: pair.escaped.privateKey,
    JWT_PUBLIC_KEY: pair.escaped.publicKey,
    VERIFICATION_CODE_SECRET: 'x'.repeat(32),
    SMTP_URL: 'smtp://localhost:1025',
    MAIL_FROM: 'AppCasa <no-reply@appcasa.local>',
  };

  it('applies defaults for optional variables', () => {
    expect(envSchema.parse(valid)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: valid.DATABASE_URL,
      JWT_PRIVATE_KEY: pair.privateKey,
      JWT_PUBLIC_KEY: pair.publicKey,
      VERIFICATION_CODE_SECRET: valid.VERIFICATION_CODE_SECRET,
      SMTP_URL: valid.SMTP_URL,
      MAIL_FROM: valid.MAIL_FROM,
    });
  });

  it('coerces PORT from string, as env vars are always strings', () => {
    expect(envSchema.parse({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a missing DATABASE_URL', () => {
    const { DATABASE_URL: _omitted, ...rest } = valid;
    expect(() => envSchema.parse(rest)).toThrow();
  });

  it('rejects a non-Postgres DATABASE_URL', () => {
    expect(() =>
      envSchema.parse({
        ...valid,
        DATABASE_URL: 'mysql://user:pass@localhost/db',
      }),
    ).toThrow();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => envSchema.parse({ ...valid, NODE_ENV: 'staging' })).toThrow();
  });

  describe('JWT keys (ADR-0008)', () => {
    it('accepts PEM keys with real newlines too', () => {
      const parsed = envSchema.parse({
        ...valid,
        JWT_PRIVATE_KEY: pair.privateKey,
        JWT_PUBLIC_KEY: pair.publicKey,
      });
      expect(parsed.JWT_PRIVATE_KEY).toBe(pair.privateKey);
    });

    it('rejects missing keys', () => {
      const { JWT_PRIVATE_KEY: _omitted, ...rest } = valid;
      expect(() => envSchema.parse(rest)).toThrow();
    });

    it('rejects a value that is not a PEM key', () => {
      expect(() =>
        envSchema.parse({ ...valid, JWT_PRIVATE_KEY: 'not-a-key' }),
      ).toThrow();
    });

    it('rejects keys of another algorithm', () => {
      const ec = generateKeyPairSync('ec', {
        namedCurve: 'P-256',
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
        publicKeyEncoding: { type: 'spki', format: 'pem' },
      });
      expect(() =>
        envSchema.parse({
          ...valid,
          JWT_PRIVATE_KEY: ec.privateKey,
          JWT_PUBLIC_KEY: ec.publicKey,
        }),
      ).toThrow();
    });

    it('rejects a public key that does not belong to the private key', () => {
      const other = ed25519Pair();
      expect(() =>
        envSchema.parse({ ...valid, JWT_PUBLIC_KEY: other.escaped.publicKey }),
      ).toThrow();
    });

    it('rejects a private key in the public key slot', () => {
      expect(() =>
        envSchema.parse({ ...valid, JWT_PUBLIC_KEY: valid.JWT_PRIVATE_KEY }),
      ).toThrow();
    });
  });

  describe('verification code secret', () => {
    it('rejects a secret shorter than 32 characters', () => {
      expect(() =>
        envSchema.parse({ ...valid, VERIFICATION_CODE_SECRET: 'x'.repeat(31) }),
      ).toThrow();
    });
  });

  describe('mail (ADR-0009)', () => {
    it('accepts smtps URLs', () => {
      expect(
        envSchema.parse({
          ...valid,
          SMTP_URL: 'smtps://user:pass@mail.example.com:465',
        }).SMTP_URL,
      ).toBe('smtps://user:pass@mail.example.com:465');
    });

    it('rejects a non-SMTP URL', () => {
      expect(() =>
        envSchema.parse({ ...valid, SMTP_URL: 'https://mail.example.com' }),
      ).toThrow();
    });

    it('rejects a missing sender', () => {
      const { MAIL_FROM: _omitted, ...rest } = valid;
      expect(() => envSchema.parse(rest)).toThrow();
    });
  });
});
