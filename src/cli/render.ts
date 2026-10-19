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

export function renderMessage(
  severity: 'error' | 'warning' | 'note',
  message: string,
  palette: Palette,
): string {
  const color =
    severity === 'error' ? 'red' : severity === 'warning' ? 'yellow' : 'cyan';
  return `${palette.paint(['bold', color], `${severity}:`)} ${message}\n`;
}

/**
 * One problem, compiler style:
 *
 *   warning: line 3: contact type "text" is not one of email, call, or coffee
 *     3 | Contact Laurie Chris text
 */
export function renderDiagnostic(
  diagnostic: Diagnostic,
  severity: 'error' | 'warning',
  palette: Palette,
): string {
  const gutter = palette.paint('dim', `  ${diagnostic.line} | `);
  return (
    renderMessage(
      severity,
      `line ${diagnostic.line}: ${diagnostic.message}`,
      palette,
    ) + `${gutter}${diagnostic.text}\n`
  );
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
