import { describe, expect, it } from 'vitest';

import { compareNames, formatList } from '../../src/utils/text.ts';

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
