import { envSchema } from './env.js';

describe('envSchema', () => {
  const valid = {
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/db',
  };

  it('applies defaults for optional variables', () => {
    expect(envSchema.parse(valid)).toEqual({
      NODE_ENV: 'development',
      PORT: 3000,
      DATABASE_URL: valid.DATABASE_URL,
    });
  });

  it('coerces PORT from string, as env vars are always strings', () => {
    expect(envSchema.parse({ ...valid, PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a missing DATABASE_URL', () => {
    expect(() => envSchema.parse({})).toThrow();
  });

  it('rejects a non-Postgres DATABASE_URL', () => {
    expect(() =>
      envSchema.parse({ DATABASE_URL: 'mysql://user:pass@localhost/db' }),
    ).toThrow();
  });

  it('rejects an unknown NODE_ENV', () => {
    expect(() => envSchema.parse({ ...valid, NODE_ENV: 'staging' })).toThrow();
  });
});
