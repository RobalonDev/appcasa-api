import { displayNameSchema, normalizeDisplayName } from './display-name.js';

describe('normalizeDisplayName', () => {
  describe('RF-27: 2 to 30 characters, without surrounding whitespace', () => {
    it('rejects 1 and 31 characters', () => {
      expect(normalizeDisplayName('A')).toBeNull();
      expect(normalizeDisplayName('a'.repeat(31))).toBeNull();
    });

    it('accepts 2 and 30 characters', () => {
      expect(normalizeDisplayName('Al')).toBe('Al');
      expect(normalizeDisplayName('a'.repeat(30))).toBe('a'.repeat(30));
    });

    it('counts without the surrounding whitespace, and stores it trimmed', () => {
      expect(normalizeDisplayName('   A   ')).toBeNull();
      expect(normalizeDisplayName(`  ${'a'.repeat(30)}  `)).toBe(
        'a'.repeat(30),
      );
      expect(normalizeDisplayName('\u00a0Ana García\u3000')).toBe('Ana García');
    });

    it('counts after NFC and stores the name in NFC', () => {
      const decomposed = 'Jose\u0301'; // é as e + combining accent
      expect(normalizeDisplayName(decomposed)).toBe('José');
      expect(normalizeDisplayName('e\u0301'.repeat(30))).toBe('é'.repeat(30));
    });

    it('rejects a name made only of whitespace', () => {
      expect(normalizeDisplayName(' \t\u00a0 ')).toBeNull();
    });

    it('rejects a missing or non-text name (plan Q3)', () => {
      for (const input of [undefined, null, 42, ['Ana']]) {
        expect(normalizeDisplayName(input)).toBeNull();
      }
    });
  });

  describe('RF-27: forbidden characters', () => {
    it.each([
      ['a control character (tab inside)', 'Ana\tGarcía'],
      ['a control character (NUL)', 'Ana\u0000'],
      ['a format character (zero-width space)', 'Ana\u200bGarcía'],
      ['a format character (BOM)', '\ufeffAna'],
      ['a format character (right-to-left override)', 'Ana\u202eaicraG'],
      ['a line separator inside', 'Ana\u2028García'],
      ['a paragraph separator inside', 'Ana\u2029García'],
      ['a private-use character', 'Ana\ue000'],
      ['an unassigned code point', 'Ana\u0378'],
    ])('rejects %s', (_case, name) => {
      expect(normalizeDisplayName(name)).toBeNull();
    });

    it('removes a tab or line separator at the ends: they are whitespace (plan «Normalización»)', () => {
      expect(normalizeDisplayName('\tAna\t')).toBe('Ana');
      expect(normalizeDisplayName('\u2028Ana\u2029')).toBe('Ana');
    });

    it.each([
      ['accents and ñ', 'Íñigo Muñoz'],
      ['inner spaces', 'Ana  María'],
      ['emojis', 'Ana 🏠'],
      ['other scripts', '李小龍'],
      ['apostrophes and hyphens', "D'Angelo-Pérez"],
    ])('accepts %s', (_case, name) => {
      expect(normalizeDisplayName(name)).toBe(name);
    });
  });
});

describe('displayNameSchema', () => {
  it('outputs the normalised name', () => {
    expect(displayNameSchema.parse('  Ana ')).toBe('Ana');
  });

  it('reports INVALID_DISPLAY_NAME (plan 001, contract)', () => {
    const result = displayNameSchema.safeParse('A');
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'INVALID_DISPLAY_NAME',
    ]);
  });
});
