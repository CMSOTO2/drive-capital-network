/** Joins items as `a, b, or c`. */
export const formatList = (items: readonly string[]): string =>
  items.length > 1
    ? `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`
    : items.join('');

/** Finds a candidate that differs from `word` only by letter case. */
export const findCaseMismatch = (
  word: string,
  candidates: readonly string[],
): string | undefined =>
  candidates.find(
    (candidate) =>
      candidate !== word && candidate.toLowerCase() === word.toLowerCase(),
  );

/**
 * Alphabetical order that ignores case (`ACME` < `apple` < `Globex`), with
 * plain code-unit order as a tiebreak so that `Acme` and `ACME` still sort
 * the same way every time.
 */
export const compareNames = (a: string, b: string): number => {
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  if (lowerA !== lowerB) return lowerA < lowerB ? -1 : 1;
  if (a === b) return 0;
  return a < b ? -1 : 1;
};
