import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

/**
 * Runs the real entry point in a child process, the way a reviewer would,
 * to cover what in-process tests can't: the shebang, `import.meta.main`,
 * process exit codes, and real pipes.
 */
const run = (args: string[], input?: string) =>
  spawnSync(process.execPath, ['src/cli/main.ts', ...args], {
    input,
    encoding: 'utf8',
    env: { ...process.env, NO_COLOR: '1' },
  });

const expected = readFileSync('examples/expected.txt', 'utf8');

describe('analyze-network (child process)', () => {
  it('reads a file', () => {
    const { status, stdout, stderr } = run(['examples/input.txt']);
    expect({ status, stdout, stderr }).toEqual({
      status: 0,
      stdout: expected,
      stderr: '',
    });
  });

  it('reads piped STDIN', () => {
    const { status, stdout } = run(
      [],
      readFileSync('examples/input.txt', 'utf8'),
    );
    expect({ status, stdout }).toEqual({ status: 0, stdout: expected });
  });

  it('exits 1 for invalid input with --strict', () => {
    expect(run(['--strict', 'examples/edge-cases.txt']).status).toBe(1);
  });

  it('exits 2 for a missing file', () => {
    expect(run(['missing.txt']).status).toBe(2);
  });
});
