import { countCharacters, trimWhiteSpace } from './text.js';

describe('trimWhiteSpace', () => {
  it('removes characters with the Unicode White_Space property at both ends', () => {
    expect(trimWhiteSpace(' \t ana  　')).toBe('ana');
  });

  it('keeps whitespace inside', () => {
    expect(trimWhiteSpace('  ana  maría  ')).toBe('ana  maría');
  });

  it('keeps U+FEFF, which JavaScript trim() would remove but is not White_Space', () => {
    expect(trimWhiteSpace('﻿ana')).toBe('﻿ana');
    expect('﻿ana'.trim()).toBe('ana');
  });
});

describe('countCharacters (spec 001, definition of «carácter»)', () => {
  it('counts code points, not UTF-16 units', () => {
    expect(countCharacters('😀')).toBe(1);
    expect('😀'.length).toBe(2);
  });

  it('counts after NFC: a decomposed accent counts as one character', () => {
    const decomposed = 'é'; // e + combining acute accent
    expect(countCharacters(decomposed)).toBe(1);
  });

  it('counts some emojis as several characters, as the spec accepts', () => {
    const family = '👨‍👩‍👧'; // three people joined by two zero-width joiners
    expect(countCharacters(family)).toBe(5);
  });
});
