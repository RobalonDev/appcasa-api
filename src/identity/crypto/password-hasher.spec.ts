import { PasswordHasher, type Argon2Params } from './password-hasher.js';

describe('PasswordHasher (ADR-0008)', () => {
  const hasher = new PasswordHasher();

  it('stores argon2id in PHC format with the OWASP parameters', async () => {
    const phc = await hasher.hash('correct horse battery staple');
    expect(phc).toMatch(
      /^\$argon2id\$v=19\$m=19456,t=2,p=1\$[A-Za-z0-9+/]{22}\$[A-Za-z0-9+/]{43}$/,
    );
  });

  it('uses a fresh salt every time', async () => {
    const password = 'correct horse battery staple';
    expect(await hasher.hash(password)).not.toBe(await hasher.hash(password));
  });

  it('verifies the right password and rejects a wrong one', async () => {
    const phc = await hasher.hash('correct horse battery staple');
    await expect(
      hasher.verify(phc, 'correct horse battery staple'),
    ).resolves.toBe(true);
    await expect(
      hasher.verify(phc, 'correct horse battery stapl'),
    ).resolves.toBe(false);
  });

  it('rejects anything that is not a valid stored hash, without throwing', async () => {
    for (const stored of [
      '',
      'plain',
      '$argon2i$v=19$m=1,t=1,p=1$AAAA$AAAA',
      '$argon2id$v=19$m=x$a$b',
    ]) {
      await expect(hasher.verify(stored, 'whatever')).resolves.toBe(false);
    }
  });

  it('RNF-2: with no stored hash it still computes one, and fails', async () => {
    await expect(
      hasher.verify(null, 'correct horse battery staple'),
    ).resolves.toBe(false);
  });

  describe('RF-39: canonically equivalent passwords are the same password', () => {
    const composed = 'contraseña segura'; // ñ as one code point (NFC)
    const decomposed = 'contrasen\u0303a segura'; // n + combining tilde (NFD)

    it('verifies a password typed in NFD against one stored in NFC', async () => {
      expect(composed).not.toBe(decomposed);
      const phc = await hasher.hash(composed);
      await expect(hasher.verify(phc, decomposed)).resolves.toBe(true);
    });

    it('treats compatibility variants (full-width letters) as different passwords', async () => {
      const phc = await hasher.hash('password-de-casa');
      await expect(
        hasher.verify(phc, 'ｐａｓｓｗｏｒｄ-de-casa'),
      ).resolves.toBe(false);
    });
  });

  describe('needsRehash', () => {
    it('is false for a hash made with the current parameters', async () => {
      expect(
        hasher.needsRehash(await hasher.hash('correct horse battery staple')),
      ).toBe(false);
    });

    it('is true for a hash made with other parameters, which still verifies', async () => {
      const weaker: Argon2Params = { memory: 8192, passes: 1, parallelism: 1 };
      const old = await new PasswordHasher(weaker).hash(
        'correct horse battery staple',
      );

      expect(hasher.needsRehash(old)).toBe(true);
      await expect(
        hasher.verify(old, 'correct horse battery staple'),
      ).resolves.toBe(true);
    });
  });
});
