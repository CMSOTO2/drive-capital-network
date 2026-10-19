import { rankRelationships, type CompanyRelationships } from './analyze.ts';
import { Network } from './network.ts';
import { parseLine } from './parse.ts';

/** A problem with one input line. The line was skipped. */
export interface Diagnostic {
  /** 1-based, counting every line including blanks and comments. */
  line: number;
  /** The input line as written, minus any trailing carriage return. */
  text: string;
  message: string;
}

export interface PipelineOptions {
  /** Stop at the first invalid line instead of skipping it. */
  strict?: boolean;
}

export interface PipelineResult {
  report: CompanyRelationships[];
  diagnostics: Diagnostic[];
  /** Lines that produced a valid, applied command. */
  commandCount: number;
  /** True when --strict stopped processing early; `report` is then empty. */
  aborted: boolean;
}

/**
 * Runs every line through parse → network, then ranks the result. Takes any
 * iterable of lines, so the CLI can stream a file of any size and tests can
 * pass a plain array.
 */
export async function analyzeLines(
  lines: AsyncIterable<string> | Iterable<string>,
  { strict = false }: PipelineOptions = {},
): Promise<PipelineResult> {
  const network = new Network();
  const diagnostics: Diagnostic[] = [];
  let commandCount = 0;
  let lineNumber = 0;

  for await (const rawLine of lines) {
    lineNumber += 1;
    const parsed = parseLine(rawLine);
    if (parsed.status === 'skip') continue;

    const message =
      parsed.status === 'error'
        ? parsed.message
        : network.apply(parsed.command);
    if (message === undefined) {
      commandCount += 1;
      continue;
    }

    diagnostics.push({
      line: lineNumber,
      text: rawLine.replace(/\r$/, ''),
      message,
    });
    if (strict) {
      return { report: [], diagnostics, commandCount, aborted: true };
    }
  }

  return {
    report: rankRelationships(network),
    diagnostics,
    commandCount,
    aborted: false,
  };
}
