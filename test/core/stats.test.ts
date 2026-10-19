import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { analyzeLines } from '../../src/core/pipeline.ts';
import { summarize } from '../../src/core/stats.ts';

const linesOf = async (path: string) =>
  (await readFile(path, 'utf8')).split('\n').slice(0, -1);

describe('summarize', () => {
  it('summarizes the prompt example', async () => {
    const result = await analyzeLines(await linesOf('examples/input.txt'));
    expect(summarize(result)).toEqual({
      lines: { read: 13, commands: 13, skipped: 0, ignored: 0 },
      partners: 3,
      companies: { total: 3, withRelationship: 2, withoutRelationship: 1 },
      employees: 3,
      contacts: { total: 4, byType: { email: 2, call: 1, coffee: 1 } },
      skipped: [],
    });
  });

  it('counts skipped lines by reason, most common first', async () => {
    const result = await analyzeLines(await linesOf('examples/edge-cases.txt'));
    const stats = summarize(result);
    expect(stats.lines).toEqual({
      read: 28,
      commands: 15,
      skipped: 11,
      ignored: 2,
    });
    expect(stats.skipped).toEqual([
      { reason: 'undeclaredName', label: 'undeclared name', count: 4 },
      { reason: 'unknownCommand', label: 'unknown command', count: 2 },
      { reason: 'employeeRedeclared', label: 'employee redeclared', count: 1 },
      {
        reason: 'invalidContactType',
        label: 'invalid contact type',
        count: 1,
      },
      { reason: 'invalidName', label: 'invalid name', count: 1 },
      {
        reason: 'swappedArguments',
        label: 'swapped contact arguments',
        count: 1,
      },
      { reason: 'wrongWordCount', label: 'wrong word count', count: 1 },
    ]);
  });

  it('never includes names, only counts', async () => {
    const result = await analyzeLines(await linesOf('examples/input.txt'));
    const json = JSON.stringify(summarize(result));
    for (const name of ['Chris', 'Molly', 'Globex', 'Laurie']) {
      expect(json).not.toContain(name);
    }
  });
});
