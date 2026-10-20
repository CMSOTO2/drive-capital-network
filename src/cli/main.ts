import { createReadStream, readFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import { basename, dirname, parse } from 'node:path';
import type { Readable, Writable } from 'node:stream';

import { z } from 'zod';

import { EXIT_CODES } from '../constants.ts';
import { selectCompanies } from '../core/analyze.ts';
import { formatJsonReport, formatTextReport } from '../core/format.ts';
import { analyzeLines, type PipelineResult } from '../core/pipeline.ts';
import { summarize } from '../core/stats.ts';
import { didYouMean, didYouMeanOneOf, suggest } from '../utils/suggest.ts';
import { escapeText, quote } from '../utils/text.ts';
import { parseCliArgs } from './args.ts';
import { HELP_TEXT, PROGRAM_NAME, USAGE_HINT } from './help.ts';
import { readLines } from './lines.ts';
import {
  createPalette,
  renderDiagnostics,
  renderMessage,
  renderStats,
  chooseOutputStyle,
  type Palette,
} from './render.ts';

/** Everything the CLI touches in the outside world, injectable for tests. */
export interface CliIo {
  argv: readonly string[];
  stdin: Readable & { isTTY?: boolean };
  stdout: Writable & { isTTY?: boolean };
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

/**
 * A file next to `path` that was probably meant: the same name with an
 * extension (`input` → `input.txt`), or a close spelling (`inptu.txt`).
 * Keeps the directory as the user typed it.
 */
async function suggestFile(path: string): Promise<string | undefined> {
  let names: string[];
  try {
    const entries = await readdir(dirname(path), { withFileTypes: true });
    names = entries.filter((entry) => entry.isFile()).map(({ name }) => name);
  } catch {
    return undefined;
  }

  const typed = basename(path);
  const match =
    names.find((name) => parse(name).name === typed) ?? suggest(typed, names);
  return match === undefined
    ? undefined
    : path.slice(0, path.length - typed.length) + match;
}

/** Fails fast with a clear message before any line is read. */
async function openFile(path: string): Promise<Readable> {
  const cannotRead = (reason: string) =>
    new InputError(`cannot read "${escapeText(path)}": ${reason}`);

  let isDirectory: boolean;
  try {
    isDirectory = (await stat(path)).isDirectory();
  } catch (error) {
    const hint =
      (error as NodeJS.ErrnoException).code === 'ENOENT'
        ? didYouMean(await suggestFile(path))
        : '';
    throw cannotRead(describeFsError(error) + hint);
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
  try {
    return await analyzeLines(readLines(input), { strict });
  } catch (error) {
    throw new InputError(`cannot read ${source}: ${describeFsError(error)}`);
  } finally {
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
  const { layout, color } = chooseOutputStyle({
    plainFlag: args.ok && args.options.plain,
    flag: args.ok ? args.options.color : undefined,
    isTTY: io.stderr.isTTY,
    env: io.env,
  });
  const palette = createPalette(color);

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

  // Everything about the input goes to stderr, before the report.
  let notices = '';
  if (!options.quiet || result.aborted) {
    notices += renderDiagnostics(result, palette, layout, {
      statsShown: options.stats,
    });
  }
  if (options.stats) {
    const stats = summarize(result);
    notices +=
      options.format === 'json'
        ? `${JSON.stringify(stats, null, 2)}\n`
        : renderStats(stats, palette);
  }
  if (result.aborted) {
    io.stderr.write(notices);
    return EXIT_CODES.inputProblem;
  }

  const { selected, missing } = selectCompanies(result.report, options.company);
  for (const { name, matches } of missing) {
    notices += renderMessage(
      'error',
      `company ${quote(name)} isn't in the input${didYouMeanOneOf(matches)}`,
      palette,
    );
  }

  // On a terminal, stderr and stdout land on the same screen; a blank line
  // keeps the last warning from running into the report. Only on stderr, so
  // piped or redirected output is unchanged.
  const sharesScreen = io.stderr.isTTY === true && io.stdout.isTTY === true;
  if (notices !== '' && sharesScreen && selected.length > 0) notices += '\n';
  io.stderr.write(notices);

  io.stdout.write(
    options.format === 'json'
      ? formatJsonReport(selected)
      : formatTextReport(selected, { details: options.details }),
  );
  return missing.length > 0 ? EXIT_CODES.inputProblem : EXIT_CODES.ok;
}

/** Runs the CLI against the real process: argv, streams, env, exit code. */
export async function runFromProcess(): Promise<void> {
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
