#!/usr/bin/env node
import { createReadStream, readFileSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';

import { z } from 'zod';

import { EXIT_CODES } from '../constants.ts';
import { formatJsonReport, formatTextReport } from '../core/format.ts';
import { analyzeLines, type PipelineResult } from '../core/pipeline.ts';
import { parseCliArgs } from './args.ts';
import { HELP_TEXT, PROGRAM_NAME, USAGE_HINT } from './help.ts';
import {
  createPalette,
  renderDiagnostics,
  renderMessage,
  shouldUseColor,
  type Palette,
} from './render.ts';

/** Everything the CLI touches in the outside world, injectable for tests. */
export interface CliIo {
  argv: readonly string[];
  stdin: Readable & { isTTY?: boolean };
  stdout: Writable;
  stderr: Writable & { isTTY?: boolean };
  env: Record<string, string | undefined>;
}

class InputError extends Error {}

function describeFsError(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | undefined)?.code;
  switch (code) {
    case 'ENOENT':
      return 'no such file';
    case 'EACCES':
    case 'EPERM':
      return 'permission denied';
    case 'EISDIR':
      return 'it is a directory';
    default:
      return error instanceof Error ? error.message : String(error);
  }
}

/** Fails fast with a clear message before any line is read. */
async function openFile(path: string): Promise<Readable> {
  const cannotRead = (reason: string) =>
    new InputError(`cannot read "${path}": ${reason}`);

  let isDirectory: boolean;
  try {
    isDirectory = (await stat(path)).isDirectory();
  } catch (error) {
    throw cannotRead(describeFsError(error));
  }
  if (isDirectory) throw cannotRead('it is a directory');

  return createReadStream(path);
}

function readVersion(): string {
  const raw = readFileSync(new URL('../../package.json', import.meta.url));
  return z.object({ version: z.string() }).parse(JSON.parse(raw.toString()))
    .version;
}

async function analyzeInput(
  input: Readable,
  strict: boolean,
  source: string,
): Promise<PipelineResult> {
  const lines = createInterface({ input, crlfDelay: Infinity });
  try {
    return await analyzeLines(lines, { strict });
  } catch (error) {
    throw new InputError(`cannot read ${source}: ${describeFsError(error)}`);
  } finally {
    lines.close();
    input.destroy();
  }
}

function fail(io: CliIo, palette: Palette, message: string): number {
  io.stderr.write(renderMessage('error', message, palette));
  return EXIT_CODES.usage;
}

/** Runs the CLI and returns the exit code. */
export async function main(io: CliIo): Promise<number> {
  const args = parseCliArgs(io.argv);
  const palette = createPalette(
    shouldUseColor({
      flag: args.ok ? args.options.color : undefined,
      isTTY: io.stderr.isTTY,
      env: io.env,
    }),
  );

  if (!args.ok) {
    return fail(io, palette, `${args.message}\n${USAGE_HINT}`);
  }
  const { options } = args;

  if (options.help) {
    io.stdout.write(HELP_TEXT);
    return EXIT_CODES.ok;
  }
  if (options.version) {
    io.stdout.write(`${PROGRAM_NAME} ${readVersion()}\n`);
    return EXIT_CODES.ok;
  }
  if (options.file === undefined && io.stdin.isTTY) {
    return fail(
      io,
      palette,
      `no input: pass a file, or pipe one in (cat input.txt | ${PROGRAM_NAME})\n${USAGE_HINT}`,
    );
  }

  let result: PipelineResult;
  try {
    const input =
      options.file === undefined ? io.stdin : await openFile(options.file);
    const source = options.file === undefined ? 'STDIN' : `"${options.file}"`;
    result = await analyzeInput(input, options.strict, source);
  } catch (error) {
    if (error instanceof InputError) return fail(io, palette, error.message);
    throw error;
  }

  if (!options.quiet || result.aborted) {
    io.stderr.write(renderDiagnostics(result, palette));
  }
  if (result.aborted) return EXIT_CODES.invalidInput;

  io.stdout.write(
    options.format === 'json'
      ? formatJsonReport(result.report)
      : formatTextReport(result.report),
  );
  return EXIT_CODES.ok;
}

if (import.meta.main) {
  // `analyze-network big.txt | head -1` closes the pipe early; that's fine.
  process.stdout.on('error', (error: NodeJS.ErrnoException) => {
    if (error.code === 'EPIPE') process.exit(EXIT_CODES.ok);
    throw error;
  });
  process.exitCode = await main({
    argv: process.argv.slice(2),
    stdin: process.stdin,
    stdout: process.stdout,
    stderr: process.stderr,
    env: process.env,
  });
}
