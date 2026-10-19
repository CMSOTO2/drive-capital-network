import { describe, expect, it } from 'vitest';

import {
  didYouMean,
  editDistance,
  maxSuggestionEdits,
  suggest,
} from '../../src/utils/suggest.ts';

describe('editDistance', () => {
  it.each([
    ['', '', 0],
    ['abc', '', 3],
    ['', 'abc', 3],
    ['coffee', 'coffee', 0],
    ['cofee', 'coffee', 1],
    ['Contcat', 'Contact', 1],
    ['Lauri', 'Laurie', 1],
    ['kitten', 'sitting', 3],
  ])('%j → %j is %i', (a, b, expected) => {
    expect(editDistance(a, b)).toBe(expected);
    expect(editDistance(b, a)).toBe(expected);
  });
});

describe('maxSuggestionEdits', () => {
  it.each([
    [1, 0],
    [2, 0],
    [3, 1],
    [4, 1],
    [5, 2],
    [20, 2],
  ])('allows a %i-letter word %i edits', (length, edits) => {
    expect(maxSuggestionEdits(length)).toBe(edits);
  });
});

describe('suggest', () => {
  const keywords = ['Partner', 'Company', 'Employee', 'Contact'];

  it('suggests a candidate that differs only by case', () => {
    expect(suggest('PARTNER', keywords)).toBe('Partner');
  });

  it('suggests the closest candidate for a typo', () => {
    expect(suggest('Contcat', keywords)).toBe('Contact');
    expect(suggest('Employe', keywords)).toBe('Employee');
  });

  it('returns undefined for an exact match', () => {
    expect(suggest('Partner', keywords)).toBeUndefined();
  });

  it('returns undefined when nothing is close enough', () => {
    expect(suggest('Investor', keywords)).toBeUndefined();
  });

  it('allows fewer edits for short words', () => {
    expect(suggest('Bo', ['Al'])).toBeUndefined();
    expect(suggest('AL', ['Al'])).toBe('Al');
    expect(suggest('Rob', ['Bob'])).toBe('Bob');
  });

  it('breaks ties alphabetically', () => {
    expect(suggest('Jon', ['Jen', 'Jan'])).toBe('Jan');
  });

  it('accepts any iterable', () => {
    expect(suggest('Lauri', new Set(['Laurie', 'Jamie']))).toBe('Laurie');
  });
});

describe('didYouMean', () => {
  it('formats a suggestion', () => {
    expect(didYouMean('Laurie')).toBe(' (did you mean "Laurie"?)');
  });

  it('is empty without one', () => {
    expect(didYouMean(undefined)).toBe('');
  });
});
