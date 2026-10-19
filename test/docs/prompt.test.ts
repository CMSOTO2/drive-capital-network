import { readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/cli.ts';

/**
 * Runs the example from the prompt exactly as the prompt shows it, comment
 * line included, so the program and `docs/prompt.md` can't drift apart.
 */
const prompt = await readFile('docs/prompt.md', 'utf8');
const codeBlocks = [...prompt.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map(
  (match) => match[1] ?? '',
);
const [exampleInput = '', exampleRun = ''] = codeBlocks;
// The second block is a shell session: drop the `$ ruby …` line.
const exampleOutput = exampleRun.replace(/^\$.*\n/, '');

describe('the prompt in docs/prompt.md', () => {
  it('contains the example input and expected output', () => {
    expect(exampleInput).toMatch(/^# input\.txt/);
    expect(exampleOutput).toMatch(/^ACME: No current relationship\n/);
  });

  it('produces the expected output for its example, exactly as written', async () => {
    expect(await runCli([], { stdin: exampleInput })).toEqual({
      code: 0,
      stdout: exampleOutput,
      stderr: '',
    });
  });

  it('matches examples/input.txt, which drops the comment line', async () => {
    const withoutComment = exampleInput.replace(/^#.*\n/, '');
    expect(await readFile('examples/input.txt', 'utf8')).toBe(withoutComment);
    expect(await readFile('examples/expected.txt', 'utf8')).toBe(exampleOutput);
  });
});
