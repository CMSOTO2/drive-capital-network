import {
  MAX_QUOTED_LENGTH,
  QUOTED_HEAD_LENGTH,
  QUOTED_TAIL_LENGTH,
} from '../constants.ts';

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

/** `1,234`: thousands separators make big counts easier to read. */
export const formatCount = (count: number): string =>
  count.toLocaleString('en-US');

/**
 * `"Chris"` for a message. A name too long to read is shortened to its start
 * and end plus its length, so one huge word can't flood the terminal:
 * `"LongAAAAAAAAAAAAAAAA...AAAAAAAAAA" (100,004 characters)`. ASCII only, so
 * it suits the plain layout too.
 */
export const quote = (name: string): string => {
  if (name.length <= MAX_QUOTED_LENGTH) return `"${name}"`;
  const start = name.slice(0, QUOTED_HEAD_LENGTH);
  const end = name.slice(-QUOTED_TAIL_LENGTH);
  return `"${start}...${end}" (${formatCount(name.length)} characters)`;
};
