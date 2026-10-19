import { PassThrough, Readable } from 'node:stream';

import { main } from '../../src/cli/main.ts';

export interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

const collect = (stream: PassThrough): (() => string) => {
  const chunks: string[] = [];
  stream.on('data', (chunk: Buffer) => chunks.push(chunk.toString()));
  return () => chunks.join('');
};

/** Runs the CLI in-process with fake streams. */
export async function runCli(
  argv: string[],
  {
    stdin = '',
    stdinIsTTY = false,
    env = {},
  }: {
    stdin?: string;
    stdinIsTTY?: boolean;
    env?: Record<string, string>;
  } = {},
): Promise<CliRun> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const readStdout = collect(stdout);
  const readStderr = collect(stderr);
  const input = Object.assign(Readable.from([stdin]), {
    isTTY: stdinIsTTY,
  });

  const code = await main({ argv, stdin: input, stdout, stderr, env });
  return { code, stdout: readStdout(), stderr: readStderr() };
}
