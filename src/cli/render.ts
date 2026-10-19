import { styleText } from 'node:util';

import { MAX_PRINTED_DIAGNOSTICS } from '../constants.ts';
import type { Diagnostic, PipelineResult } from '../core/pipeline.ts';

type Style = Parameters<typeof styleText>[0];

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

const plural = (count: number, word: string): string =>
  `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;

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

/**
 * A row of `^` under the given words, e.g. `            ^^^^` for word 2 of
 * `Contact Laurie Chris text`. Tabs are shown as single spaces so the markers
 * line up.
 */
export function underlineWords(text: string, words: readonly number[]): string {
  const spans = [...text.matchAll(/\S+/g)].map((match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }));

  let underline = '';
  for (const position of [...new Set(words)].toSorted((a, b) => a - b)) {
    const span = spans[position];
    if (span === undefined) continue;
    underline += ' '.repeat(span.start - underline.length);
    underline += '^'.repeat(span.end - span.start);
  }
  return underline;
}

/**
 * One problem, compiler style:
 *
 *   warning: line 20: contact skipped: partner "Rezzan" hasn't been declared
 *     20 | Contact Peter Rezzan call
 *        |               ^^^^^^
 *        = note: "Rezzan" is declared later, on line 21; …
 */
export function renderDiagnostic(
  diagnostic: Diagnostic,
  severity: 'error' | 'warning',
  palette: Palette,
): string {
  const lineNumber = String(diagnostic.line);
  const blankGutter = ' '.repeat(lineNumber.length);
  const shownText = diagnostic.text.replaceAll('\t', ' ');

  let output = renderMessage(
    severity,
    `line ${lineNumber}: ${diagnostic.message}`,
    palette,
  );
  output += `${palette.paint('dim', `  ${lineNumber} | `)}${shownText}\n`;

  const underline = underlineWords(shownText, diagnostic.words);
  if (underline !== '') {
    const marker = palette.paint(SEVERITY_COLORS[severity], underline);
    output += `${palette.paint('dim', `  ${blankGutter} | `)}${marker}\n`;
  }

  for (const note of diagnostic.notes) {
    output += `  ${blankGutter} ${palette.paint('dim', '=')} ${palette.paint('bold', 'note:')} ${note}\n`;
  }
  return output;
}

/** Everything the CLI writes to stderr about the input itself. */
export function renderDiagnostics(
  result: PipelineResult,
  palette: Palette,
): string {
  const { diagnostics, aborted, commandCount, report } = result;

  if (aborted) {
    const [first] = diagnostics;
    if (!first) return '';
    return (
      renderDiagnostic(first, 'error', palette) +
      renderMessage(
        'note',
        `stopped at line ${first.line} because of --strict`,
        palette,
      )
    );
  }

  if (diagnostics.length === 0) {
    return report.length === 0
      ? renderMessage(
          'note',
          'the input declares no companies, so there is nothing to report',
          palette,
        )
      : '';
  }

  const shown = diagnostics.slice(0, MAX_PRINTED_DIAGNOSTICS);
  const hidden = diagnostics.length - shown.length;
  let output = shown
    .map((diagnostic) => renderDiagnostic(diagnostic, 'warning', palette))
    .join('');
  if (hidden > 0) {
    output += palette.paint('dim', `…and ${plural(hidden, 'more warning')}\n`);
  }

  output += renderMessage(
    'note',
    `skipped ${plural(diagnostics.length, 'invalid line')}; use --strict to fail instead`,
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
