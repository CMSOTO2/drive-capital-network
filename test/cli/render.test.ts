import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  createPalette,
  renderDiagnostic,
  renderDiagnostics,
  shouldUseColor,
} from '../../src/cli/render.ts';
import { MAX_PRINTED_DIAGNOSTICS } from '../../src/constants.ts';
import type { Diagnostic, PipelineResult } from '../../src/core/pipeline.ts';

const plain = createPalette(false);
const diagnostic: Diagnostic = {
  line: 3,
  text: 'Contact Laurie Chris text',
  message: 'contact type "text" is not one of email, call, or coffee',
};
const resultWith = (overrides: Partial<PipelineResult>): PipelineResult => ({
  report: [{ company: 'ACME', partners: [] }],
  diagnostics: [],
  commandCount: 1,
  aborted: false,
  ...overrides,
});

describe('renderDiagnostic', () => {
  it('shows the message and the offending line', () => {
    expect(renderDiagnostic(diagnostic, 'warning', plain)).toBe(
      'warning: line 3: contact type "text" is not one of email, call, or coffee\n' +
        '  3 | Contact Laurie Chris text\n',
    );
  });

  it('adds ANSI colors only when enabled', () => {
    const colored = renderDiagnostic(diagnostic, 'error', createPalette(true));
    expect(colored).not.toBe(renderDiagnostic(diagnostic, 'error', plain));
    expect(stripVTControlCharacters(colored)).toBe(
      renderDiagnostic(diagnostic, 'error', plain),
    );
  });
});

describe('renderDiagnostics', () => {
  it('prints nothing for clean input', () => {
    expect(renderDiagnostics(resultWith({}), plain)).toBe('');
  });

  it('notes when the input declared no companies', () => {
    expect(renderDiagnostics(resultWith({ report: [] }), plain)).toBe(
      'note: the input declares no companies, so there is nothing to report\n',
    );
  });

  it('lists warnings and suggests --strict', () => {
    expect(
      renderDiagnostics(resultWith({ diagnostics: [diagnostic] }), plain),
    ).toMatch(/note: skipped 1 invalid line; use --strict to fail instead\n$/);
  });

  it('caps the number of warnings and summarizes the rest', () => {
    const diagnostics = Array.from(
      { length: MAX_PRINTED_DIAGNOSTICS + 1205 },
      (_, index) => ({ ...diagnostic, line: index + 1 }),
    );
    const output = renderDiagnostics(resultWith({ diagnostics }), plain);
    expect(output.match(/^warning:/gm)).toHaveLength(MAX_PRINTED_DIAGNOSTICS);
    expect(output).toContain('…and 1,205 more warnings\n');
    expect(output).toContain(
      `skipped ${(MAX_PRINTED_DIAGNOSTICS + 1205).toLocaleString('en-US')} invalid lines`,
    );
  });

  it('asks whether it is the right file when nothing was valid', () => {
    expect(
      renderDiagnostics(
        resultWith({ diagnostics: [diagnostic], commandCount: 0, report: [] }),
        plain,
      ),
    ).toContain('Is this the right file?');
  });

  it('shows an error and where it stopped in strict mode', () => {
    expect(
      renderDiagnostics(
        resultWith({ diagnostics: [diagnostic], aborted: true, report: [] }),
        plain,
      ),
    ).toBe(
      'error: line 3: contact type "text" is not one of email, call, or coffee\n' +
        '  3 | Contact Laurie Chris text\n' +
        'note: stopped at line 3 because of --strict\n',
    );
  });
});

describe('shouldUseColor', () => {
  it('obeys an explicit flag first', () => {
    expect(shouldUseColor({ flag: false, isTTY: true, env: {} })).toBe(false);
    expect(
      shouldUseColor({ flag: true, isTTY: false, env: { NO_COLOR: '1' } }),
    ).toBe(true);
  });

  it('turns color off for NO_COLOR', () => {
    expect(
      shouldUseColor({ flag: undefined, isTTY: true, env: { NO_COLOR: '1' } }),
    ).toBe(false);
  });

  it('honors FORCE_COLOR', () => {
    expect(
      shouldUseColor({
        flag: undefined,
        isTTY: false,
        env: { FORCE_COLOR: '1' },
      }),
    ).toBe(true);
    expect(
      shouldUseColor({
        flag: undefined,
        isTTY: true,
        env: { FORCE_COLOR: '0' },
      }),
    ).toBe(false);
  });

  it('defaults to color only on a terminal', () => {
    expect(shouldUseColor({ flag: undefined, isTTY: true, env: {} })).toBe(
      true,
    );
    expect(shouldUseColor({ flag: undefined, isTTY: false, env: {} })).toBe(
      false,
    );
  });
});
