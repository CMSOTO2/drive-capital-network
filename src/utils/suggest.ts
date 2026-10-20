import {
  MAX_LISTED_MATCHES,
  MAX_SUGGESTION_LENGTH,
  MIN_PREFIX_MATCH_LENGTH,
  SUGGESTION_EDIT_LIMITS,
  SUGGESTION_MAX_EDITS,
} from '../constants.ts';
import { compareNames, formatCount, formatList, quote } from './text.ts';

/**
 * How many single-letter edits turn `a` into `b`. Each of these is one edit:
 *
 * - delete a letter            `coffee` → `cofee`
 * - insert a letter            `cofee` → `coffee`
 * - replace a letter           `call` → `cell`
 * - swap two letters next to each other   `Contcat` → `Contact`
 *
 * It works from the end of both words. If the last letters match, they cost
 * nothing and we compare what's left. If not, we try each kind of edit and
 * keep the cheapest. Answers for each pair of lengths are remembered, so no
 * pair is worked out twice.
 *
 * Only call it on short words (see MAX_SUGGESTION_LENGTH): the work grows
 * with the length of `a` times the length of `b`.
 */
export function editDistance(a: string, b: string): number {
  const remembered = new Map<string, number>();

  // Edits needed to turn the first `i` letters of `a` into the first `j` of `b`.
  function edits(i: number, j: number): number {
    // One word is used up: add or delete the rest of the other one.
    if (i === 0) return j;
    if (j === 0) return i;

    const key = `${i},${j}`;
    const known = remembered.get(key);
    if (known !== undefined) return known;

    const lastOfA = a[i - 1];
    const lastOfB = b[j - 1];

    let best: number;
    if (lastOfA === lastOfB) {
      best = edits(i - 1, j - 1);
    } else {
      const deleteFromA = edits(i - 1, j) + 1;
      const insertIntoA = edits(i, j - 1) + 1;
      const replaceInA = edits(i - 1, j - 1) + 1;
      best = Math.min(deleteFromA, insertIntoA, replaceInA);
    }

    // `ac` against `ca`: swapping the last two letters is one edit.
    const lastTwoAreSwapped =
      i > 1 && j > 1 && lastOfA === b[j - 2] && a[i - 2] === lastOfB;
    if (lastTwoAreSwapped) {
      best = Math.min(best, edits(i - 2, j - 2) + 1);
    }

    remembered.set(key, best);
    return best;
  }

  return edits(a.length, b.length);
}

/** How many edits a word of this length can be off by and still get a hint. */
export function maxSuggestionEdits(length: number): number {
  const limit = SUGGESTION_EDIT_LIMITS.find(
    ({ maxLength }) => length <= maxLength,
  );
  return limit?.edits ?? SUGGESTION_MAX_EDITS;
}

/**
 * The candidate `word` was most likely meant to be, for "did you mean" hints.
 *
 * Letter case is ignored, so `partner` suggests `Partner`. Short words allow
 * fewer edits, so `Al` doesn't suggest `Bo`. Ties go to the alphabetically
 * first candidate. Returns undefined when `word` is itself a candidate,
 * nothing is close enough, or `word` is longer than MAX_SUGGESTION_LENGTH.
 */
export function suggest(
  word: string,
  candidates: Iterable<string>,
): string | undefined {
  if (word.length > MAX_SUGGESTION_LENGTH) return undefined;
  const maxEdits = maxSuggestionEdits(word.length);
  let best: { candidate: string; distance: number } | undefined;

  for (const candidate of candidates) {
    if (candidate === word) return undefined;

    // Cheap check first: a big length difference already needs too many edits.
    if (Math.abs(candidate.length - word.length) > maxEdits) continue;

    const distance = editDistance(word.toLowerCase(), candidate.toLowerCase());
    if (distance > maxEdits) continue;

    const isCloser = best === undefined || distance < best.distance;
    const isTieButFirstAlphabetically =
      best !== undefined &&
      distance === best.distance &&
      compareNames(candidate, best.candidate) < 0;
    if (isCloser || isTieButFirstAlphabetically) {
      best = { candidate, distance };
    }
  }

  return best?.candidate;
}

/** ` (did you mean "X"?)`, or an empty string when there's no suggestion. */
export function didYouMean(suggestion: string | undefined): string {
  return suggestion === undefined
    ? ''
    : ` (did you mean ${quote(suggestion)}?)`;
}

/**
 * Every candidate `word` could mean, for hints that shouldn't guess between
 * them, alphabetically:
 *
 * - names it's the start of: `Glob` → `Globe`, `Globex`
 * - the closest spellings, ignoring case: `acme` → `ACME`, `Acme`, and
 *   `Globx` → `Globe`, `Globex` (one edit each). `Globexx` only gets
 *   `Globex`, since `Globe` is two edits away.
 *
 * Empty when `word` is itself a candidate.
 */
export function possibleMatches(
  word: string,
  candidates: Iterable<string>,
): string[] {
  const lowerWord = word.toLowerCase();
  const maxEdits = maxSuggestionEdits(word.length);
  const canCompareSpelling = word.length <= MAX_SUGGESTION_LENGTH;
  const startsWithWord: string[] = [];
  let closest: string[] = [];
  let closestDistance = Infinity;

  for (const candidate of candidates) {
    if (candidate === word) return [];
    const lowerCandidate = candidate.toLowerCase();

    if (
      word.length >= MIN_PREFIX_MATCH_LENGTH &&
      lowerCandidate.startsWith(lowerWord)
    ) {
      startsWithWord.push(candidate);
    }

    if (!canCompareSpelling) continue;
    if (Math.abs(candidate.length - word.length) > maxEdits) continue;
    const distance = editDistance(lowerWord, lowerCandidate);
    if (distance > maxEdits || distance > closestDistance) continue;
    if (distance < closestDistance) {
      closest = [];
      closestDistance = distance;
    }
    closest.push(candidate);
  }

  return [...new Set([...startsWithWord, ...closest])].toSorted(compareNames);
}

/**
 * ` (did you mean "Globe" or "Globex"?)` for one or more matches, or an
 * empty string for none. Lists at most MAX_LISTED_MATCHES and counts the rest.
 */
export function didYouMeanOneOf(matches: readonly string[]): string {
  if (matches.length === 0) return '';
  const listed = matches.slice(0, MAX_LISTED_MATCHES);
  const unlisted = matches.length - listed.length;
  const more =
    unlisted === 0 ? '' : ` ${formatCount(unlisted)} more also match`;
  return ` (did you mean ${formatList(listed.map((match) => quote(match)))}?${more})`;
}
