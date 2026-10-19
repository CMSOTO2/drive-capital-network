import { describe, expect, it } from 'vitest';

import { MAX_PRINTED_DIAGNOSTICS } from '../../src/constants.ts';
import { analyzeLines } from '../../src/core/pipeline.ts';

const lines = [
  'Partner Chris',
  '',
  '# a comment',
  'Company ACME',
  'Employee Sam ACME',
  'Contact Sam Chris text',
  'Contact Sam Chris call\r',
  'Contact Ghost Chris call',
];

async function* stream() {
  yield 'Company ACME';
  yield 'Company Hooli';
}

describe('analyzeLines', () => {
  it('reports each bad line with its 1-based number, counting blanks and comments', async () => {
    const result = await analyzeLines(lines);
    expect(result.diagnostics).toEqual([
      {
        line: 6,
        text: 'Contact Sam Chris text',
        message: 'contact type "text" is not one of email, call, or coffee',
        reason: 'invalidContactType',
        words: [3],
        notes: [],
      },
      {
        line: 8,
        text: 'Contact Ghost Chris call',
        message: 'contact skipped: employee "Ghost" hasn\'t been declared',
        reason: 'undeclaredName',
        words: [1],
        notes: [],
      },
    ]);
  });

  it('keeps going past bad lines and ranks what it could apply', async () => {
    const result = await analyzeLines(lines);
    expect(result.aborted).toBe(false);
    expect(result.commandCount).toBe(4);
    expect(result.report).toEqual([
      { company: 'ACME', partners: [{ partner: 'Chris', strength: 1 }] },
    ]);
  });

  it('stops at the first bad line in strict mode', async () => {
    const result = await analyzeLines(lines, { strict: true });
    expect(result.aborted).toBe(true);
    expect(result.report).toEqual([]);
    expect(result.diagnostics.map(({ line }) => line)).toEqual([6]);
  });

  it('does not abort in strict mode when every line is valid', async () => {
    const result = await analyzeLines(['Company ACME'], { strict: true });
    expect(result.aborted).toBe(false);
    expect(result.report).toEqual([{ company: 'ACME', partners: [] }]);
  });

  it('strips a trailing carriage return from the echoed line', async () => {
    const result = await analyzeLines(['Bogus line\r']);
    expect(result.diagnostics[0]?.text).toBe('Bogus line');
  });

  it('notes when a missing name is declared later in the file', async () => {
    const result = await analyzeLines([
      'Company ACME',
      'Employee Sam ACME',
      'Contact Sam Rezzan call',
      'Contact Sam Rezzan email',
      'Partner Rezzan',
      'Partner Rezzan',
    ]);
    const note =
      '"Rezzan" is declared later, on line 5; declarations must come before the lines that use them';
    expect(
      result.diagnostics.map(({ line, notes }) => ({ line, notes })),
    ).toEqual([
      { line: 3, notes: [note] },
      { line: 4, notes: [note] },
    ]);
  });

  it('notes a company declared after the employee that uses it', async () => {
    const result = await analyzeLines(['Employee Sam ACME', 'Company ACME']);
    expect(result.diagnostics[0]?.notes).toEqual([
      '"ACME" is declared later, on line 2; declarations must come before the lines that use them',
    ]);
  });

  it('does not link names of different kinds', async () => {
    const result = await analyzeLines([
      'Company ACME',
      'Employee Sam ACME',
      'Contact Sam Rezzan call',
      'Employee Rezzan ACME',
    ]);
    expect(result.diagnostics[0]?.notes).toEqual([]);
  });

  it('strips a byte order mark from the echoed line', async () => {
    const result = await analyzeLines(['\uFEFFBogus line']);
    expect(result.diagnostics[0]?.text).toBe('Bogus line');
  });

  it('keeps details for the first few problems and counts the rest', async () => {
    const bad = Array.from(
      { length: MAX_PRINTED_DIAGNOSTICS + 30 },
      (_, index) => (index % 2 === 0 ? 'Bogus line' : 'Partner'),
    );
    const result = await analyzeLines(['Company ACME', ...bad]);
    expect(result.diagnostics).toHaveLength(MAX_PRINTED_DIAGNOSTICS);
    expect(result.skippedCount).toBe(MAX_PRINTED_DIAGNOSTICS + 30);
    expect(result.skippedByReason).toEqual({
      unknownCommand: (MAX_PRINTED_DIAGNOSTICS + 30) / 2,
      wrongWordCount: (MAX_PRINTED_DIAGNOSTICS + 30) / 2,
    });
    expect(result.report).toEqual([{ company: 'ACME', partners: [] }]);
  });

  it('skips name suggestions once details are no longer kept', async () => {
    const input = [
      'Partner Chris',
      'Company ACME',
      'Employee Laurie ACME',
      ...Array.from({ length: MAX_PRINTED_DIAGNOSTICS }, () => 'Bogus line'),
      'Contact Lauri Chris call',
    ];
    const result = await analyzeLines(input);
    expect(result.skippedByReason.undeclaredName).toBe(1);
    expect(
      result.diagnostics.some(({ message }) => message.includes('Lauri')),
    ).toBe(false);
  });

  it('accepts an async iterable of lines', async () => {
    const result = await analyzeLines(stream());
    expect(result.report.map(({ company }) => company)).toEqual([
      'ACME',
      'Hooli',
    ]);
  });

  it('handles empty input', async () => {
    expect(await analyzeLines([])).toEqual({
      report: [],
      diagnostics: [],
      skippedCount: 0,
      skippedByReason: {},
      lineCount: 0,
      ignoredLineCount: 0,
      commandCount: 0,
      counts: {
        partners: 0,
        companies: 0,
        companiesWithContacts: 0,
        employees: 0,
        contactsByType: { email: 0, call: 0, coffee: 0 },
      },
      aborted: false,
    });
  });

  it('counts every line, ignored lines, and commands', async () => {
    const result = await analyzeLines(lines);
    expect({
      lineCount: result.lineCount,
      ignoredLineCount: result.ignoredLineCount,
      commandCount: result.commandCount,
    }).toEqual({ lineCount: 8, ignoredLineCount: 2, commandCount: 4 });
  });
});
