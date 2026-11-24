import { emailSchema, MAX_EMAIL_LENGTH, normalizeEmail } from './email.js';

/** A syntactically valid address of exactly `length` characters. */
function emailOfLength(length: number): string {
  const domain = '@example.com';
  return 'a'.repeat(length - domain.length) + domain;
}

describe('normalizeEmail', () => {
  describe('RF-26: same email regardless of case and surrounding whitespace', () => {
    it('lowercases the address', () => {
      expect(normalizeEmail('Ana.Garcia@Example.COM')).toBe(
        'ana.garcia@example.com',
      );
    });

    it('ignores whitespace of any kind at both ends', () => {
      const spaces = [' ', '\t', '\n', '\r\n', ' ', ' ', '　'];
      for (const space of spaces) {
        expect(normalizeEmail(`${space}ana@example.com${space}`)).toBe(
          'ana@example.com',
        );
      }
    });

    it('does not treat U+FEFF (a format character, not whitespace) as space', () => {
      expect(normalizeEmail('﻿ana@example.com')).toBeNull();
    });

    it('does not unify aliases (spec D9)', () => {
      expect(normalizeEmail('ana+casa@example.com')).toBe(
        'ana+casa@example.com',
      );
      expect(normalizeEmail('a.na@example.com')).toBe('a.na@example.com');
    });
  });

  describe('RF-35: rejects addresses that are not valid emails', () => {
    it.each([
      ['no at sign', 'ana.example.com'],
      ['no local part', '@example.com'],
      ['no domain', 'ana@'],
      ['domain without a dot (plan E2)', 'ana@localhost'],
      ['quoted local part (plan E2)', '"ana"@example.com'],
      ['inner space', 'ana maria@example.com'],
      ['Unicode domain (plan E2)', 'ana@españa.es'],
      ['Unicode local part (plan E2)', 'josé@example.com'],
      [
        'punycode top-level domain (plan E2, accepted risk)',
        'ana@xn--p1ai.xn--p1ai',
      ],
      ['empty string', ''],
      ['only whitespace', '   '],
    ])('%s', (_case, input) => {
      expect(normalizeEmail(input)).toBeNull();
    });

    it('accepts a punycode domain below an ASCII top-level domain (plan E2)', () => {
      expect(normalizeEmail('ana@xn--espaa-rta.es')).toBe(
        'ana@xn--espaa-rta.es',
      );
    });

    it(`accepts up to ${MAX_EMAIL_LENGTH} characters and rejects one more`, () => {
      expect(normalizeEmail(emailOfLength(254))).toBe(emailOfLength(254));
      expect(normalizeEmail(emailOfLength(255))).toBeNull();
    });

    it('counts the length without the surrounding whitespace', () => {
      expect(normalizeEmail(`  ${emailOfLength(254)}  `)).toBe(
        emailOfLength(254),
      );
    });

    it('rejects anything that is not a string, including a missing value', () => {
      for (const input of [undefined, null, 42, {}, ['ana@example.com']]) {
        expect(normalizeEmail(input)).toBeNull();
      }
    });
  });
});

describe('emailSchema (RF-26, RF-35)', () => {
  it('outputs the normalised email', () => {
    expect(emailSchema.parse('  Ana@Example.com ')).toBe('ana@example.com');
  });

  it('reports INVALID_EMAIL, the code clients rely on (plan 001, contract)', () => {
    const result = emailSchema.safeParse('not-an-email');
    expect(result.success).toBe(false);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'INVALID_EMAIL',
    ]);
  });

  it('reports INVALID_EMAIL for a missing email', () => {
    const result = emailSchema.safeParse(undefined);
    expect(result.error?.issues.map((issue) => issue.message)).toEqual([
      'INVALID_EMAIL',
    ]);
  });
});
