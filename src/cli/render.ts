import { styleText } from 'node:util';

import {
  EXCERPT_LEAD,
  MAX_EXCERPT_WIDTH,
  MAX_PRINTED_DIAGNOSTICS,
} from '../constants.ts';
import type { Diagnostic, PipelineResult } from '../core/pipeline.ts';
import type { RunStats } from '../core/stats.ts';
import { formatCount, quote } from '../utils/text.ts';

type Style = Parameters<typeof styleText>[0];

/**
 * `rich` decorates diagnostics with a gutter and `^` markers. `plain` is for
 * screen readers and dumb terminals: no decoration, ASCII only, and the words
 * at fault are named in text instead of marked.
 */
export type Layout = 'rich' | 'plain';

export interface Palette {
  paint(style: Style, text: string): string;
}

export const createPalette = (enabled: boolean): Palette => ({
  paint: (style, text) =>
    enabled ? styleText(style, text, { validateStream: false }) : text,
});

export interface ColorContext {
  /** --color / --no-color; undefined when neither was passed. */
  flag: boolean | undefined;
  isTTY: boolean | undefined;
  env: Record<string, string | undefined>;
}

/** Follows https://no-color.org and the FORCE_COLOR convention. */
export function shouldUseColor({ flag, isTTY, env }: ColorContext): boolean {
  if (flag !== undefined) return flag;
  if (env['NO_COLOR']) return false;
  if (env['FORCE_COLOR'] !== undefined) return env['FORCE_COLOR'] !== '0';
  return isTTY === true;
}

export interface OutputStyleContext extends ColorContext {
  /** --plain */
  plainFlag: boolean;
}

/**
 * Plain layout when asked for, or when the terminal says it can't handle
 * more (`TERM=dumb`). Plain output is uncolored unless --color says otherwise.
 */
export function chooseOutputStyle({
  plainFlag,
  flag,
  isTTY,
  env,
}: OutputStyleContext): { layout: Layout; color: boolean } {
  const layout: Layout = plainFlag || env['TERM'] === 'dumb' ? 'plain' : 'rich';

  if (flag !== undefined) return { layout, color: flag };
  if (layout === 'plain') return { layout, color: false };
  return { layout, color: shouldUseColor({ flag, isTTY, env }) };
}

const plural = (count: number, word: string): string =>
  `${formatCount(count)} ${word}${count === 1 ? '' : 's'}`;

export type Severity = 'error' | 'warning' | 'note';

const SEVERITY_COLORS = {
  error: 'red',
  warning: 'yellow',
  note: 'cyan',
} as const satisfies Record<Severity, Style>;

export function renderMessage(
  severity: Severity,
  message: string,
  palette: Palette,
): string {
  const label = palette.paint(
    ['bold', SEVERITY_COLORS[severity]],
    `${severity}:`,
  );
  return `${label} ${message}\n`;
}

/** Where each word of `text` starts and ends. */
function wordSpans(text: string): { start: number; end: number }[] {
  return [...text.matchAll(/\S+/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));
}

/** The given word positions in order, without duplicates. */
const uniqueSorted = (positions: readonly number[]): number[] =>
  [...new Set(positions)].toSorted((a, b) => a - b);

/**
 * A row of `^` under the given words, e.g. `            ^^^^` for word 2 of
 * `Contact Laurie Chris text`. Tabs are shown as single spaces so the markers
 * line up.
 */
export function underlineWords(text: string, words: readonly number[]): string {
  const spans = wordSpans(text);
  let underline = '';
  for (const position of uniqueSorted(words)) {
    const span = spans[position];
    if (span === undefined) continue;
    underline += ' '.repeat(span.start - underline.length);
    underline += '^'.repeat(span.end - span.start);
  }
  return underline;
}

/**
 * The part of a line a warning shows, with its `^` row to match. A line
 * longer than MAX_EXCERPT_WIDTH is cut to that width. The cut keeps the
 * start of the line when the first word at fault fits there, and otherwise
 * starts a little before that word; `ellipsis` marks each cut end:
 *
 *   …x x x x Partner Chris2 x x x x…
 *                    ^^^^^^
 */
export function excerpt(
  text: string,
  words: readonly number[],
  ellipsis: string,
): { text: string; underline: string } {
  const underline = underlineWords(text, words);
  if (text.length <= MAX_EXCERPT_WIDTH) return { text, underline };

  // Start at the beginning of the line when the first word at fault fits
  // there; otherwise start a little before that word.
  const [firstWord] = uniqueSorted(words);
  const focus =
    firstWord === undefined ? undefined : wordSpans(text)[firstWord];
  const fitsAtStart = focus === undefined || focus.end <= MAX_EXCERPT_WIDTH;
  const start = fitsAtStart
    ? 0
    : Math.max(
        0,
        Math.min(focus.start - EXCERPT_LEAD, text.length - MAX_EXCERPT_WIDTH),
      );
  const end = start + MAX_EXCERPT_WIDTH;

  const cutBefore = start > 0 ? ellipsis : '';
  const cutAfter = end < text.length ? ellipsis : '';
  return {
    text: cutBefore + text.slice(start, end) + cutAfter,
    underline: (
      ' '.repeat(cutBefore.length) + underline.slice(start, end)
    ).trimEnd(),
  };
}

/** The text of the given words, e.g. `["Chris", "Sarah"]`. */
export function wordsAt(text: string, words: readonly number[]): string[] {
  const allWords = text.match(/\S+/g) ?? [];
  return uniqueSorted(words)
    .map((position) => allWords[position])
    .filter((word) => word !== undefined);
}

/**
 * One problem, compiler style (rich layout):
 *
 *   warning: line 20: contact skipped: partner "Rezzan" hasn't been declared
 *     20 | Contact Peter Rezzan call
 *        |               ^^^^^^
 *        = note: "Rezzan" is declared later, on line 21; ...
 *
 * The plain layout says the same thing in words:
 *
 *   warning: line 20: contact skipped: partner "Rezzan" hasn't been declared
 *     line 20 reads: Contact Peter Rezzan call
 *     word at fault: "Rezzan"
 *     note: "Rezzan" is declared later, on line 21; ...
 */
export function renderDiagnostic(
  diagnostic: Diagnostic,
  severity: 'error' | 'warning',
  palette: Palette,
  layout: Layout = 'rich',
): string {
  const lineNumber = String(diagnostic.line);
  const shown = excerpt(
    diagnostic.text.replaceAll('\t', ' '),
    diagnostic.words,
    layout === 'plain' ? '...' : '…',
  );
  let output = renderMessage(
    severity,
    `line ${lineNumber}: ${diagnostic.message}`,
    palette,
  );

  if (layout === 'plain') {
    output += `  line ${lineNumber} reads: ${shown.text}\n`;
    const atFault = wordsAt(diagnostic.text, diagnostic.words);
    if (atFault.length > 0) {
      const label = atFault.length === 1 ? 'word at fault' : 'words at fault';
      const quoted = atFault.map((word) => quote(word)).join(', ');
      output += `  ${label}: ${quoted}\n`;
    }
    for (const note of diagnostic.notes) {
      output += `  note: ${note}\n`;
    }
    return output;
  }

  const blankGutter = ' '.repeat(lineNumber.length);
  output += `${palette.paint('dim', `  ${lineNumber} | `)}${shown.text}\n`;

  if (shown.underline !== '') {
    const marker = palette.paint(SEVERITY_COLORS[severity], shown.underline);
    output += `${palette.paint('dim', `  ${blankGutter} | `)}${marker}\n`;
  }

  for (const note of diagnostic.notes) {
    output += `  ${blankGutter} ${palette.paint('dim', '=')} ${palette.paint('bold', 'note:')} ${note}\n`;
  }
  return output;
}

export interface DiagnosticsOptions {
  /** Whether --stats is on; if not, a cut-off list of warnings points to it. */
  statsShown?: boolean;
}

/** Everything the CLI writes to stderr about the input itself. */
export function renderDiagnostics(
  result: PipelineResult,
  palette: Palette,
  layout: Layout = 'rich',
  { statsShown = false }: DiagnosticsOptions = {},
): string {
  const { diagnostics, skippedCount, aborted, commandCount, report } = result;

  if (aborted) {
    const [first] = diagnostics;
    if (!first) return '';
    return (
      renderDiagnostic(first, 'error', palette, layout) +
      renderMessage(
        'note',
        `stopped at line ${first.line} because of --strict`,
        palette,
      )
    );
  }

  if (skippedCount === 0) {
    return report.length === 0
      ? renderMessage(
          'note',
          'the input declares no companies, so there is nothing to report',
          palette,
        )
      : '';
  }

  // The pipeline keeps details for at most MAX_PRINTED_DIAGNOSTICS lines.
  const shown = diagnostics.slice(0, MAX_PRINTED_DIAGNOSTICS);
  const hidden = skippedCount - shown.length;
  let output = shown
    .map((diagnostic) =>
      renderDiagnostic(diagnostic, 'warning', palette, layout),
    )
    .join('');
  if (hidden > 0) {
    // Not dimmed: it's information, and dim text is hard to read on many
    // terminal themes. Plain layout sticks to ASCII.
    const ellipsis = layout === 'plain' ? '...' : '…';
    const breakdown = statsShown
      ? ''
      : ' (add --stats to count them by reason)';
    output += `${ellipsis}and ${plural(hidden, 'more warning')}${breakdown}\n`;
  }

  output += renderMessage(
    'note',
    `skipped ${plural(skippedCount, 'invalid line')}; use --strict to fail instead`,
    palette,
  );
  if (commandCount === 0) {
    output += renderMessage(
      'note',
      'no line in the input was a valid command. Is this the right file?',
      palette,
    );
  }
  return output;
}

/**
 * The `--stats` summary, one labelled line per topic:
 *
 *   stats:
 *     lines: 28 read, 14 commands, 11 skipped, 3 blank or comments
 *     companies: 4 (2 with a relationship, 2 without)
 *     contacts: 4 (1 email, 1 call, 2 coffee)
 *     skipped lines: 11
 *       undeclared name: 4
 *       unknown command: 2
 *
 * Skipped lines get a row per reason, so the summary doesn't wrap.
 */
export function renderStats(stats: RunStats, palette: Palette): string {
  const { lines, companies, contacts } = stats;

  const contactTypes = Object.entries(contacts.byType)
    .map(([type, count]) => `${formatCount(count)} ${type}`)
    .join(', ');
  const skippedRows = stats.skipped.map(
    ({ label, count }) => `  ${label}: ${formatCount(count)}`,
  );

  const rows = [
    `lines: ${formatCount(lines.read)} read, ${formatCount(lines.commands)} commands, ${formatCount(lines.skipped)} skipped, ${formatCount(lines.ignored)} blank or comments`,
    `partners: ${formatCount(stats.partners)}`,
    `companies: ${formatCount(companies.total)} (${formatCount(companies.withRelationship)} with a relationship, ${formatCount(companies.withoutRelationship)} without)`,
    `employees: ${formatCount(stats.employees)}`,
    `contacts: ${formatCount(contacts.total)} (${contactTypes})`,
    `skipped lines: ${skippedRows.length === 0 ? 'none' : formatCount(lines.skipped)}`,
    ...skippedRows,
  ];
  return `${palette.paint('bold', 'stats:')}\n${rows.map((row) => `  ${row}\n`).join('')}`;
}
