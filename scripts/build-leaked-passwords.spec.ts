import { filterLeakedPasswords } from './build-leaked-passwords.js';

describe('filterLeakedPasswords (plan 001, decision E1)', () => {
  it('keeps only passwords of 12 to 128 characters, the only ones RF-24 can reject', () => {
    const lines = ['short', 'exactly12chr', 'x'.repeat(128), 'x'.repeat(129)];
    expect(filterLeakedPasswords(lines)).toEqual([
      'exactly12chr',
      'x'.repeat(128),
    ]);
  });

  it('normalises to NFC, drops duplicates and blank lines, and keeps the original order', () => {
    const lines = [
      'qwerty123456',
      '',
      'contrasen\u0303a123',
      'contraseña123',
      'abcdefghijkl',
    ];
    expect(filterLeakedPasswords(lines)).toEqual([
      'qwerty123456',
      'contraseña123',
      'abcdefghijkl',
    ]);
  });

  it('counts characters after NFC, as RF-23 does', () => {
    const decomposed = 'n\u0303'.repeat(12); // 24 code points, 12 characters
    expect(filterLeakedPasswords([decomposed])).toEqual(['ñ'.repeat(12)]);
  });

  it('strips the carriage return of Windows line endings', () => {
    expect(filterLeakedPasswords(['abcdefghijkl\r'])).toEqual(['abcdefghijkl']);
  });
});
