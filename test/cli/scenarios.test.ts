import { readdir, readFile } from 'node:fs/promises';

import { describe, expect, it } from 'vitest';

import { runCli } from '../helpers/cli.ts';

const DIRECTORY = 'examples/scenarios';

/** Every `<name>.txt` in the scenarios folder that has a `<name>.expected.txt`. */
const scenarios = (await readdir(DIRECTORY))
  .filter((file) => file.endsWith('.txt') && !file.endsWith('.expected.txt'))
  .map((file) => file.slice(0, -'.txt'.length))
  .toSorted();

describe('example scenarios', () => {
  it('finds the scenarios', () => {
    expect(scenarios.length).toBeGreaterThan(20);
  });

  it.each(scenarios)('%s', async (name) => {
    const expected = await readFile(
      `${DIRECTORY}/${name}.expected.txt`,
      'utf8',
    );
    const { code, stdout } = await runCli([`${DIRECTORY}/${name}.txt`]);
    expect({ code, stdout }).toEqual({ code: 0, stdout: expected });
  });
});
