import { describe, expect, it } from 'vitest';

import { findCaseMismatch, formatList } from '../../src/utils/text.ts';

describe('formatList', () => {
  it.each([
    [[], ''],
    [['email'], 'email'],
    [['email', 'call'], 'email, or call'],
    [['email', 'call', 'coffee'], 'email, call, or coffee'],
  ])('formats %j as %j', (items, expected) => {
    expect(formatList(items)).toBe(expected);
  });
});

describe('findCaseMismatch', () => {
  const candidates = ['Partner', 'Company'];

  it('finds a candidate that differs only by case', () => {
    expect(findCaseMismatch('PARTNER', candidates)).toBe('Partner');
  });

  it('ignores an exact match', () => {
    expect(findCaseMismatch('Partner', candidates)).toBeUndefined();
  });

  it('returns undefined when nothing matches', () => {
    expect(findCaseMismatch('Investor', candidates)).toBeUndefined();
  });
});
