import { parseArgs } from 'node:util';

import { STDIN_ARG } from '../constants.ts';
import { CliOptionsSchema, type CliOptions } from '../schemas/options.ts';

export type ArgsResult =
  | { ok: true; options: CliOptions }
  | { ok: false; message: string };

const OPTIONS = {
  help: { type: 'boolean', short: 'h' },
  version: { type: 'boolean', short: 'v' },
  strict: { type: 'boolean' },
  quiet: { type: 'boolean', short: 'q' },
  color: { type: 'boolean' },
  format: { type: 'string', short: 'f' },
} as const;

/** Node's parseArgs messages are long; keep the part a user needs. */
function describeParseError(error: unknown): string {
  if (!(error instanceof Error)) return String(error);
  const code = (error as NodeJS.ErrnoException).code;
  const quoted = /'([^']+)'/.exec(error.message)?.[1];
  if (code === 'ERR_PARSE_ARGS_UNKNOWN_OPTION' && quoted) {
    return `unknown option "${quoted}"`;
  }
  if (code === 'ERR_PARSE_ARGS_INVALID_OPTION_VALUE' && quoted) {
    return `option "${quoted}" needs a value`;
  }
  return error.message;
}

/** Turns argv (without `node` and the script) into validated options. */
export function parseCliArgs(argv: readonly string[]): ArgsResult {
  let parsed;
  try {
    parsed = parseArgs({
      args: [...argv],
      options: OPTIONS,
      allowPositionals: true,
      allowNegative: true,
      strict: true,
    });
  } catch (error) {
    return { ok: false, message: describeParseError(error) };
  }

  const { values, positionals } = parsed;
  if (positionals.length > 1) {
    return {
      ok: false,
      message: `expected at most one input file, got ${positionals.length}: ${positionals.join(' ')}`,
    };
  }

  const [file] = positionals;
  const result = CliOptionsSchema.safeParse({
    ...values,
    file: file === STDIN_ARG ? undefined : file,
  });
  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues.map((issue) => issue.message).join('; '),
    };
  }
  return { ok: true, options: result.data };
}
