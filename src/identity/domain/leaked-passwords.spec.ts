import { BUNDLED_LIST, LeakedPasswords } from './leaked-passwords.js';

describe('LeakedPasswords', () => {
  it('finds listed passwords, in NFC', () => {
    const list = new LeakedPasswords(['contraseña123']); // stored decomposed
    expect(list.has('contraseña123')).toBe(true);
    expect(list.has('otra cosa')).toBe(false);
  });

  it('is case-sensitive: it holds exact leaked passwords', () => {
    const list = new LeakedPasswords(['qwerty123456']);
    expect(list.has('QWERTY123456')).toBe(false);
  });

  describe('RNF-5: works without any external service', () => {
    const realFetch = globalThis.fetch;

    beforeEach(() => {
      globalThis.fetch = () =>
        Promise.reject(new Error('no network in this test'));
    });

    afterEach(() => {
      globalThis.fetch = realFetch;
    });

    it('loads the list bundled with the app and answers synchronously', async () => {
      const list = await LeakedPasswords.fromFile(BUNDLED_LIST);
      expect(list.size).toBeGreaterThan(30_000);
      expect(list.has('qwerty123456')).toBe(true);
      expect(list.has('una frase larga que nadie habría filtrado jamás')).toBe(
        false,
      );
    });
  });
});
