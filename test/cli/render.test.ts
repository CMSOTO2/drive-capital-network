import { stripVTControlCharacters } from 'node:util';

import { describe, expect, it } from 'vitest';

import {
  createPalette,
  excerpt,
  visibleLine,
  renderDiagnostic,
  renderDiagnostics,
  chooseOutputStyle,
  renderStats,
  shouldUseColor,
  underlineWords,
  wordsAt,
} from '../../src/cli/render.ts';
import {
  EXCERPT_LEAD,
  MAX_EXCERPT_WIDTH,
  MAX_PRINTED_DIAGNOSTICS,
} from '../../src/constants.ts';
import type { Diagnostic, PipelineResult } from '../../src/core/pipeline.ts';

const plain = createPalette(false);
const diagnostic: Diagnostic = {
  line: 3,
  text: 'Contact Laurie Chris text',
  message: 'contact type "text" is not one of email, call, or coffee',
  reason: 'invalidContactType',
  words: [3],
  notes: [],
};
const resultWith = (overrides: Partial<PipelineResult>): PipelineResult => ({
  report: [{ company: 'ACME', partners: [] }],
  diagnostics: [],
  skippedCount: 0,
  skippedByReason: {},
  lineCount: 1,
  ignoredLineCount: 0,
  commandCount: 1,
  counts: {
    partners: 0,
    companies: 1,
    companiesWithContacts: 0,
    employees: 0,
    contactsByType: { email: 0, call: 0, coffee: 0 },
  },
  aborted: false,
  ...overrides,
});

/** As the pipeline reports it: details for the first few, a count for all. */
const manySkipped = (skippedCount: number) =>
  resultWith({
    diagnostics: Array.from(
      { length: Math.min(skippedCount, MAX_PRINTED_DIAGNOSTICS) },
      (_, index) => ({ ...diagnostic, line: index + 1 }),
    ),
    skippedCount,
  });

describe('renderDiagnostic', () => {
  it('shows the message and the offending line', () => {
    expect(renderDiagnostic(diagnostic, 'warning', plain)).toBe(
      'warning: line 3: contact type "text" is not one of email, call, or coffee\n' +
        '  3 | Contact Laurie Chris text\n' +
        '    |                      ^^^^\n',
    );
  });

  it('pads the gutter to the width of the line number', () => {
    const output = renderDiagnostic(
      { ...diagnostic, line: 120, words: [1] },
      'warning',
      plain,
    );
    expect(output).toContain('  120 | Contact Laurie Chris text\n');
    expect(output).toContain('      |         ^^^^^^\n');
  });

  it('leaves out the marker row when no word is at fault', () => {
    expect(
      renderDiagnostic({ ...diagnostic, words: [] }, 'warning', plain),
    ).not.toContain('^');
  });

  it('says the same thing in words in the plain layout', () => {
    expect(
      renderDiagnostic(
        { ...diagnostic, notes: ['"text" appears later'] },
        'warning',
        plain,
        'plain',
      ),
    ).toBe(
      'warning: line 3: contact type "text" is not one of email, call, or coffee\n' +
        '  line 3 reads: Contact Laurie Chris text\n' +
        '  word at fault: "text"\n' +
        '  note: "text" appears later\n',
    );
  });

  it('lists several words at fault in the plain layout', () => {
    expect(
      renderDiagnostic(
        { ...diagnostic, words: [1, 2] },
        'warning',
        plain,
        'plain',
      ),
    ).toContain('  words at fault: "Laurie", "Chris"\n');
  });

  it('adds notes below the line', () => {
    expect(
      renderDiagnostic(
        { ...diagnostic, notes: ['"Rezzan" is declared later, on line 21'] },
        'warning',
        plain,
      ),
    ).toMatch(/\n {4}= note: "Rezzan" is declared later, on line 21\n$/);
  });

  it('adds ANSI colors only when enabled', () => {
    const colored = renderDiagnostic(diagnostic, 'error', createPalette(true));
    expect(colored).not.toBe(renderDiagnostic(diagnostic, 'error', plain));
    expect(stripVTControlCharacters(colored)).toBe(
      renderDiagnostic(diagnostic, 'error', plain),
    );
  });
});

describe('renderDiagnostic with a long line', () => {
  const long = {
    ...diagnostic,
    text: `Contact Laurie Chris text ${'x '.repeat(200)}`,
  };

  it('cuts the line and keeps the markers under the word', () => {
    const output = renderDiagnostic(long, 'warning', plain);
    const [, shown = '', markers = ''] = output.split('\n');
    expect(shown.length).toBeLessThan(MAX_EXCERPT_WIDTH + 10);
    expect(shown.endsWith('…')).toBe(true);
    expect(markers).toBe('    |                      ^^^^');
  });

  it('cuts with ASCII dots in the plain layout', () => {
    const output = renderDiagnostic(long, 'warning', plain, 'plain');
    expect(output).toMatch(
      /line 3 reads: Contact Laurie Chris text x .*x \.\.\.\n/,
    );
    expect(output).toContain('word at fault: "text"');
  });
});

describe('renderDiagnostic with invisible characters', () => {
  const hidden: Diagnostic = {
    ...diagnostic,
    text: 'Contact Laurie Chris\u00a0text\u001b[31m',
    words: [3],
  };

  it('never writes a raw control character', () => {
    for (const layout of ['rich', 'plain'] as const) {
      const output = renderDiagnostic(hidden, 'warning', plain, layout);
      expect(output.includes('\u001b')).toBe(false);
      expect(output.includes('\u00a0')).toBe(false);
    }
  });

  it('keeps the markers under the word at fault', () => {
    const [, shown = '', markers = ''] = renderDiagnostic(
      hidden,
      'warning',
      plain,
    ).split('\n');
    const start = markers.indexOf('^');
    expect(shown.slice(start, markers.length)).toBe(String.raw`text\u001b[31m`);
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
      renderDiagnostics(
        resultWith({ diagnostics: [diagnostic], skippedCount: 1 }),
        plain,
      ),
    ).toMatch(/note: skipped 1 invalid line; use --strict to fail instead\n$/);
  });

  it('caps the number of warnings and summarizes the rest', () => {
    const output = renderDiagnostics(
      manySkipped(MAX_PRINTED_DIAGNOSTICS + 1205),
      plain,
    );
    expect(output.match(/^warning:/gm)).toHaveLength(MAX_PRINTED_DIAGNOSTICS);
    expect(output).toContain(
      '\n…and 1,205 more warnings (add --stats to count them by reason)\n',
    );
    expect(output).toContain(
      `skipped ${(MAX_PRINTED_DIAGNOSTICS + 1205).toLocaleString('en-US')} invalid lines`,
    );
  });

  it('never dims the "more warnings" line, and uses ASCII when plain', () => {
    const result = manySkipped(MAX_PRINTED_DIAGNOSTICS + 1);
    const colored = renderDiagnostics(result, createPalette(true));
    expect(colored).toMatch(/\n…and 1 more warning \(/);
    expect(renderDiagnostics(result, plain, 'plain')).toContain(
      '\n...and 1 more warning (',
    );
  });

  it('leaves out the --stats pointer when the stats are already shown', () => {
    const output = renderDiagnostics(
      manySkipped(MAX_PRINTED_DIAGNOSTICS + 1),
      plain,
      'rich',
      { statsShown: true },
    );
    expect(output).toContain('\n…and 1 more warning\n');
  });

  it('asks whether it is the right file when nothing was valid', () => {
    expect(
      renderDiagnostics(
        resultWith({
          diagnostics: [diagnostic],
          skippedCount: 1,
          commandCount: 0,
          report: [],
        }),
        plain,
      ),
    ).toContain('Is this the right file?');
  });

  it('shows an error and where it stopped in strict mode', () => {
    expect(
      renderDiagnostics(
        resultWith({
          diagnostics: [diagnostic],
          skippedCount: 1,
          aborted: true,
          report: [],
        }),
        plain,
      ),
    ).toBe(
      'error: line 3: contact type "text" is not one of email, call, or coffee\n' +
        '  3 | Contact Laurie Chris text\n' +
        '    |                      ^^^^\n' +
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

describe('underlineWords', () => {
  const line = 'Contact Laurie Chris text';

  it('marks one word', () => {
    expect(underlineWords(line, [1])).toBe('        ^^^^^^');
  });

  it('marks several words, in any order, once each', () => {
    expect(underlineWords(line, [3, 1, 3])).toBe('        ^^^^^^       ^^^^');
  });

  it('follows extra spaces between words', () => {
    expect(underlineWords('  Partner   Chris2', [1])).toBe(
      '            ^^^^^^',
    );
  });

  it('ignores positions past the end of the line', () => {
    expect(underlineWords('Company', [4])).toBe('');
  });
});

describe('renderStats', () => {
  it('prints one labelled line per topic, and a row per skip reason', () => {
    expect(
      renderStats(
        {
          lines: { read: 1200, commands: 1100, skipped: 60, ignored: 40 },
          partners: 3,
          companies: { total: 5, withRelationship: 4, withoutRelationship: 1 },
          employees: 20,
          contacts: {
            total: 1050,
            byType: { email: 1000, call: 30, coffee: 20 },
          },
          skipped: [
            { reason: 'undeclaredName', label: 'undeclared name', count: 50 },
            { reason: 'invalidName', label: 'invalid name', count: 10 },
          ],
        },
        plain,
      ),
    ).toBe(
      [
        'stats:',
        '  lines: 1,200 read, 1,100 commands, 60 skipped, 40 blank or comments',
        '  partners: 3',
        '  companies: 5 (4 with a relationship, 1 without)',
        '  employees: 20',
        '  contacts: 1,050 (1,000 email, 30 call, 20 coffee)',
        '  skipped lines: 60',
        '    undeclared name: 50',
        '    invalid name: 10',
        '',
      ].join('\n'),
    );
  });

  it('says "none" when nothing was skipped', () => {
    const output = renderStats(
      {
        lines: { read: 0, commands: 0, skipped: 0, ignored: 0 },
        partners: 0,
        companies: { total: 0, withRelationship: 0, withoutRelationship: 0 },
        employees: 0,
        contacts: { total: 0, byType: { email: 0, call: 0, coffee: 0 } },
        skipped: [],
      },
      plain,
    );
    expect(output).toContain('  skipped lines: none\n');
  });
});

describe('visibleLine', () => {
  it('leaves an ordinary line alone', () => {
    expect(visibleLine('Contact Laurie Chris call')).toEqual({
      text: 'Contact Laurie Chris call',
      spans: [
        { start: 0, end: 7 },
        { start: 8, end: 14 },
        { start: 15, end: 20 },
        { start: 21, end: 25 },
      ],
    });
  });

  it('shows tabs as spaces', () => {
    expect(visibleLine('Partner\tChris').text).toBe('Partner Chris');
  });

  it('escapes invisible characters and moves the words after them', () => {
    const line = visibleLine('Partner Chris\u00a0Smith');
    expect(line.text).toBe(String.raw`Partner Chris\u00a0Smith`);
    const smith = line.spans[2];
    expect(line.text.slice(smith?.start, smith?.end)).toBe('Smith');
  });

  it('escapes a terminal code inside a word, keeping the whole word marked', () => {
    const line = visibleLine('Partner Ev\u001b[31mil');
    const name = line.spans[1];
    expect(line.text.slice(name?.start, name?.end)).toBe(
      String.raw`Ev\u001b[31mil`,
    );
  });
});

describe('excerpt', () => {
  const filler = 'x '.repeat(60);

  it('leaves a line that fits alone', () => {
    expect(excerpt('Contact Laurie Chris text', [3], '…')).toEqual({
      text: 'Contact Laurie Chris text',
      underline: '                     ^^^^',
    });
  });

  it('cuts a long line at the end, keeping the start in view', () => {
    const shown = excerpt(`Partner Chris2 ${filler}`, [1], '…');
    expect(shown.text).toHaveLength(MAX_EXCERPT_WIDTH + 1);
    expect(shown.text).toMatch(/^Partner Chris2 x .*…$/);
    expect(shown.underline).toBe('        ^^^^^^');
  });

  it('moves the window to the word at fault, with a little lead', () => {
    const line = `${filler}Partner Chris2 ${filler}`;
    const shown = excerpt(line, [61], '…');
    expect(shown.text).toHaveLength(MAX_EXCERPT_WIDTH + 2);
    expect(shown.text.startsWith('…')).toBe(true);
    expect(shown.text.endsWith('…')).toBe(true);
    const marker = shown.underline.indexOf('^');
    expect(shown.text.slice(marker, marker + 6)).toBe('Chris2');
    expect(marker).toBe(EXCERPT_LEAD + 1);
  });

  it('shows the end of a line whose word at fault is near the end', () => {
    const shown = excerpt(`${filler}Partner Chris2`, [61], '...');
    expect(shown.text).toMatch(/^\.\.\.x .*Partner Chris2$/);
    const marker = shown.underline.indexOf('^');
    expect(shown.text.slice(marker)).toBe('Chris2');
  });

  it('cuts a single huge word too', () => {
    const shown = excerpt(`Partner Long${'A'.repeat(5000)}1`, [1], '…');
    expect(shown.text).toHaveLength(MAX_EXCERPT_WIDTH + 1);
    expect(shown.underline).toBe(
      `        ${'^'.repeat(MAX_EXCERPT_WIDTH - 8)}`,
    );
  });
});

describe('wordsAt', () => {
  it('returns the words at the given positions, in order, once each', () => {
    expect(wordsAt('Contact Chris Sarah call', [2, 1, 2])).toEqual([
      'Chris',
      'Sarah',
    ]);
  });

  it('ignores positions past the end of the line', () => {
    expect(wordsAt('Company', [3])).toEqual([]);
  });
});

describe('chooseOutputStyle', () => {
  const base = { plainFlag: false, flag: undefined, isTTY: true, env: {} };

  it('is rich and colored on a terminal by default', () => {
    expect(chooseOutputStyle(base)).toEqual({ layout: 'rich', color: true });
  });

  it('is plain and uncolored with --plain', () => {
    expect(chooseOutputStyle({ ...base, plainFlag: true })).toEqual({
      layout: 'plain',
      color: false,
    });
  });

  it('is plain on a dumb terminal', () => {
    expect(chooseOutputStyle({ ...base, env: { TERM: 'dumb' } })).toEqual({
      layout: 'plain',
      color: false,
    });
  });

  it('lets an explicit --color win, even in plain layout', () => {
    expect(chooseOutputStyle({ ...base, plainFlag: true, flag: true })).toEqual(
      { layout: 'plain', color: true },
    );
  });
});
