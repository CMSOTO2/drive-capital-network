import { SUGGESTION_EDIT_LIMITS, SUGGESTION_MAX_EDITS } from '../constants.ts';
import { compareNames, quote } from './text.ts';

/**
 * Counts the edits needed to turn `a` into `b`. Each of these is one edit:
 *
 * - deleting a letter        (`coffee` → `cofee`)
 * - inserting a letter       (`cofee`  → `coffee`)
 * - replacing a letter       (`call`   → `cell`)
 * - swapping two neighbours  (`Contcat` → `Contact`)
 *
 * This is the "optimal string alignment" variant of Levenshtein distance.
 * It fills in a table where `cost(i, j)` is the number of edits between the
 * first `i` letters of `a` and the first `j` letters of `b`; the answer is
 * the bottom-right cell.
 */
export function editDistance(a: string, b: string): number {
  const width = b.length + 1;
  const cells = Array.from<number>({ length: (a.length + 1) * width }).fill(0);
  const cost = (i: number, j: number): number => cells[i * width + j] ?? 0;
  const setCost = (i: number, j: number, value: number): void => {
    cells[i * width + j] = value;
  };

  // Against an empty string, every letter is one insertion or deletion.
  for (let i = 0; i <= a.length; i += 1) setCost(i, 0, i);
  for (let j = 0; j <= b.length; j += 1) setCost(0, j, j);

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const sameLetter = a[i - 1] === b[j - 1];

      const deletion = cost(i - 1, j) + 1;
      const insertion = cost(i, j - 1) + 1;
      const substitution = cost(i - 1, j - 1) + (sameLetter ? 0 : 1);
      let best = Math.min(deletion, insertion, substitution);

      const swappedNeighbours =
        i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1];
      if (swappedNeighbours) {
        best = Math.min(best, cost(i - 2, j - 2) + 1);
      }

      setCost(i, j, best);
    }
  }

  return cost(a.length, b.length);
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
 * first candidate. Returns undefined when `word` is itself a candidate or
 * nothing is close enough.
 */
export function suggest(
  word: string,
  candidates: Iterable<string>,
): string | undefined {
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
