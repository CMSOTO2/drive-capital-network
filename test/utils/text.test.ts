import { describe, expect, it } from 'vitest';

import {
  compareNames,
  formatCount,
  escapeText,
  formatList,
  quote,
  showCharacter,
} from '../../src/utils/text.ts';

describe('formatList', () => {
  it.each([
    [[], ''],
    [['email'], 'email'],
    [['email', 'call'], 'email or call'],
    [['email', 'call', 'coffee'], 'email, call, or coffee'],
  ])('formats %j as %j', (items, expected) => {
    expect(formatList(items)).toBe(expected);
  });
});

describe('compareNames', () => {
  it('ignores case first', () => {
    expect(['hooli', 'Globex', 'ACME', 'apple'].toSorted(compareNames)).toEqual(
      ['ACME', 'apple', 'Globex', 'hooli'],
    );
  });

  it('falls back to code-unit order for names that differ only by case', () => {
    expect(['acme', 'Acme', 'ACME'].toSorted(compareNames)).toEqual([
      'ACME',
      'Acme',
      'acme',
    ]);
  });

  it('returns 0 for identical names', () => {
    expect(compareNames('ACME', 'ACME')).toBe(0);
  });
});

describe('formatCount', () => {
  it('adds thousands separators', () => {
    expect(formatCount(1_234_567)).toBe('1,234,567');
    expect(formatCount(12)).toBe('12');
  });
});

describe('quote', () => {
  it('quotes a name', () => {
    expect(quote('Chris')).toBe('"Chris"');
  });

  it('keeps a name of up to 40 characters whole', () => {
    const name = 'A'.repeat(40);
    expect(quote(name)).toBe(`"${name}"`);
  });

  it('shortens a longer name to its ends and gives its length', () => {
    expect(quote(`Long${'A'.repeat(5000)}1`)).toBe(
      `"Long${'A'.repeat(16)}...${'A'.repeat(9)}1" (5,005 characters)`,
    );
  });
});

describe('showCharacter and escapeText', () => {
  it.each([
    ['\u001b', String.raw`\u001b`],
    ['\u00a0', String.raw`\u00a0`],
    ['\u200b', String.raw`\u200b`],
    ['\u0000', String.raw`\u0000`],
    ['\t', String.raw`\t`],
    ['\r', String.raw`\r`],
  ])('makes %j visible', (character, shown) => {
    expect(showCharacter(character)).toBe(shown);
  });

  it.each([' ', 'a', 'Z', 'ë', '💥', '#'])(
    'leaves %j as typed',
    (character) => {
      expect(showCharacter(character)).toBe(character);
    },
  );

  it('turns a terminal color code into plain text', () => {
    expect(escapeText('Ev\u001b[31mil')).toBe(String.raw`Ev\u001b[31mil`);
  });
});

describe('quote with invisible characters', () => {
  it('escapes them', () => {
    expect(quote('Chris\u00a0Smith')).toBe(String.raw`"Chris\u00a0Smith"`);
  });

  it('escapes both ends of a shortened name', () => {
    const shown = quote(`\u001b${'A'.repeat(100)}\u001b`);
    expect(shown).not.toContain('\u001b');
    expect(shown).toMatch(/^"\\u001bA+\.\.\.A+\\u001b" \(102 characters\)$/);
  });
});
