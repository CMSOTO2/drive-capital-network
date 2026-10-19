import { describe, expect, it } from 'vitest';

import { generateStress } from '../../scripts/stress.ts';
import { formatTextReport } from '../../src/core/format.ts';
import { analyzeLines } from '../../src/core/pipeline.ts';
import { runCli } from '../helpers/cli.ts';

/**
 * Differential tests: the real program against the simple reference model in
 * scripts/stress.ts, on long generated inputs full of edge cases.
 */
describe('stress: program vs. reference model', () => {
  const seeds = Array.from({ length: 25 }, (_, index) => index + 1);

  it.each(seeds)('agrees on seed %i', async (seed) => {
    const stress = generateStress({ seed, contacts: 2_000 });
    const result = await analyzeLines(stress.text.split('\n'));

    expect(formatTextReport(result.report)).toBe(stress.expected);
    expect(result.skippedCount).toBe(stress.invalidLineCount);
    const counted = Object.values(result.counts.contactsByType).reduce(
      (sum, count) => sum + count,
      0,
    );
    expect(counted).toBe(stress.validContactCount);
  });

  it('agrees on 200,000 contacts piped through the CLI', async () => {
    const stress = generateStress({ seed: 2026, contacts: 200_000 });
    const { code, stdout } = await runCli(['--quiet'], { stdin: stress.text });
    expect(code).toBe(0);
    expect(stdout).toBe(stress.expected);
  });

  it('produces the same file for the same seed', () => {
    expect(generateStress({ seed: 7, contacts: 500 })).toEqual(
      generateStress({ seed: 7, contacts: 500 }),
    );
  });

  it('includes the edge cases it promises', () => {
    const { text, invalidLineCount } = generateStress({
      seed: 1,
      contacts: 5_000,
    });
    expect(text.startsWith('﻿')).toBe(true);
    expect(text).toContain('\r\n');
    expect(text).toContain('\t');
    expect(text).toContain('Company Acme\n');
    expect(text).toMatch(/Partner\s+LongA{100000}/);
    expect(invalidLineCount).toBeGreaterThan(100);
  });
});
