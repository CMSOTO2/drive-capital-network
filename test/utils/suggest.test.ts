import { describe, expect, it } from 'vitest';

import {
  didYouMean,
  didYouMeanOneOf,
  editDistance,
  maxSuggestionEdits,
  possibleMatches,
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

describe('very long words', () => {
  const long = `Long${'A'.repeat(100_000)}`;
  const nearlyLong = `Long${'A'.repeat(99_999)}B`;

  it('get no close-spelling hint, and return at once', () => {
    const started = performance.now();
    expect(suggest(nearlyLong, [long])).toBeUndefined();
    expect(possibleMatches(nearlyLong, [long])).toEqual([]);
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it('still match the start of a longer name', () => {
    expect(possibleMatches('Long', [long])).toEqual([long]);
  });
});

describe('possibleMatches', () => {
  const companies = ['ACME', 'Acme', 'Globe', 'Globex', 'Hooli'];

  it('lists every company a name is the start of', () => {
    expect(possibleMatches('Glob', companies)).toEqual(['Globe', 'Globex']);
    expect(possibleMatches('glo', companies)).toEqual(['Globe', 'Globex']);
  });

  it('only matches the start of names from three letters on', () => {
    expect(possibleMatches('Gl', companies)).toEqual([]);
  });

  it('lists every name that differs only by case', () => {
    expect(possibleMatches('acme', companies)).toEqual(['ACME', 'Acme']);
  });

  it('keeps only the closest spellings', () => {
    expect(possibleMatches('Globx', companies)).toEqual(['Globe', 'Globex']);
    expect(possibleMatches('Globexx', companies)).toEqual(['Globex']);
    expect(possibleMatches('Hoolie', companies)).toEqual(['Hooli']);
  });

  it('is empty for an exact match or nothing close', () => {
    expect(possibleMatches('Globe', companies)).toEqual([]);
    expect(possibleMatches('Initech', companies)).toEqual([]);
  });
});

describe('didYouMeanOneOf', () => {
  it('is empty without matches', () => {
    expect(didYouMeanOneOf([])).toBe('');
  });

  it('formats one match like didYouMean', () => {
    expect(didYouMeanOneOf(['Globex'])).toBe(didYouMean('Globex'));
  });

  it('lists several matches as a choice', () => {
    expect(didYouMeanOneOf(['Globe', 'Globex'])).toBe(
      ' (did you mean "Globe" or "Globex"?)',
    );
  });

  it('lists the first five and counts the rest', () => {
    const many = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    expect(didYouMeanOneOf(many)).toBe(
      ' (did you mean "A", "B", "C", "D", or "E"? 2 more also match)',
    );
  });
});
