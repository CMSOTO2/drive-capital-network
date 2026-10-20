import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { commandLine, DEMOS } from '../../scripts/demo.ts';
import { runCli } from '../helpers/cli.ts';

/** Keeps `pnpm demo` honest: every example still does what it says. */
describe('pnpm demo', () => {
  it.each(DEMOS)('$name ends with exit $exitCode', async (demo) => {
    const stdin =
      demo.stdinFile === undefined
        ? ''
        : await readFile(demo.stdinFile, 'utf8');
    const { code } = await runCli(demo.args, { stdin });
    expect(code).toBe(demo.exitCode);
  });

  it('is listed in docs/usage.md exactly as it runs', async () => {
    const usage = await readFile('docs/usage.md', 'utf8');
    for (const demo of DEMOS) {
      const shown = commandLine(demo).replaceAll('|', String.raw`\|`);
      expect(usage).toContain(`| \`${demo.name}\``);
      expect(usage).toContain(`\`${shown}\``);
    }
  });

  it('has unique names, so filtering is predictable', () => {
    const names = DEMOS.map(({ name }) => name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('shows each command as you would type it', () => {
    expect(
      commandLine({ name: 'x', description: '', args: ['-d'], exitCode: 0 }),
    ).toBe('analyze-network -d');
    expect(
      commandLine({
        name: 'x',
        description: '',
        args: [],
        stdinFile: 'in.txt',
        exitCode: 0,
      }),
    ).toBe('cat in.txt | analyze-network');
  });
});
