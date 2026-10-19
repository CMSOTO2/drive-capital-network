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
