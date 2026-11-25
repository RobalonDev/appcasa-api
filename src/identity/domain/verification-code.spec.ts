import { generateVerificationCode } from './verification-code.js';

describe('generateVerificationCode', () => {
  it('RF-34: always produces exactly 6 digits', () => {
    for (let i = 0; i < 1_000; i++) {
      expect(generateVerificationCode()).toMatch(/^\d{6}$/);
    }
  });

  it('RF-34: keeps leading zeros', () => {
    expect(generateVerificationCode(() => 42)).toBe('000042');
    expect(generateVerificationCode(() => 0)).toBe('000000');
    expect(generateVerificationCode(() => 999_999)).toBe('999999');
  });

  it('draws from the whole range 000000–999999', () => {
    let requestedMax: number | undefined;
    generateVerificationCode((max) => {
      requestedMax = max;
      return 0;
    });
    expect(requestedMax).toBe(1_000_000);
  });
});
