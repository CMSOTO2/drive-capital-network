/** Joins items as `a`, `a or b`, or `a, b, or c`. */
export const formatList = (items: readonly string[]): string => {
  if (items.length <= 2) return items.join(' or ');
  return `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`;
};

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
