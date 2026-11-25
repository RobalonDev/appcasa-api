import { LeakedPasswords } from './leaked-passwords.js';
import { checkPassword } from './password-policy.js';

describe('checkPassword', () => {
  const leaked = new LeakedPasswords(['qwerty123456', 'contraseña123']);
  const check = (password: unknown) => checkPassword(password, leaked);

  describe('RF-23: between 12 and 128 characters', () => {
    it('rejects 11 and 129 characters', () => {
      expect(check('a'.repeat(11))).toBe('INVALID_PASSWORD_LENGTH');
      expect(check('a'.repeat(129))).toBe('INVALID_PASSWORD_LENGTH');
    });

    it('accepts 12 and 128 characters', () => {
      expect(check('abcdefghijkl')).toBeNull();
      expect(check('x'.repeat(128))).toBeNull();
    });

    it('counts characters after NFC: 12 composed letters are 12 even if typed decomposed', () => {
      const decomposed = 'n\u0303'.repeat(12); // 12 × ñ in NFD = 24 code points
      expect(check(decomposed)).toBeNull();
    });

    it('treats a missing or non-text password as having 0 characters (plan Q3)', () => {
      expect(check(undefined)).toBe('INVALID_PASSWORD_LENGTH');
      expect(check(null)).toBe('INVALID_PASSWORD_LENGTH');
      expect(check(123456789012)).toBe('INVALID_PASSWORD_LENGTH');
    });
  });

  describe('RF-24: not a leaked password', () => {
    it('rejects a password on the list', () => {
      expect(check('qwerty123456')).toBe('BREACHED_PASSWORD');
    });

    it('RF-39: also when typed in another canonical form', () => {
      expect(check('contrasen\u0303a123')).toBe('BREACHED_PASSWORD');
    });

    it('checks the length first: a short listed password is a length problem', () => {
      const withShort = new LeakedPasswords(['short']);
      expect(checkPassword('short', withShort)).toBe('INVALID_PASSWORD_LENGTH');
    });
  });

  describe('RF-25: any character, no composition rules', () => {
    it.each([
      ['only lowercase letters', 'abcdefghijklmn'],
      ['only digits', '12345678901234'],
      ['spaces, also at both ends', '  una frase con espacios  '],
      ['emojis and symbols', '🏠🔑 mi casa €¿¡'],
      ['tabs and other whitespace', 'a\tb\u00a0c\u3000defghij'],
    ])('accepts %s', (_case, password) => {
      expect(check(password)).toBeNull();
    });

    it('does not trim: 12 characters with surrounding spaces still count them', () => {
      expect(check(' abcdefghij ')).toBeNull();
    });
  });
});
