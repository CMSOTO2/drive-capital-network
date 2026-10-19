import {
  BYTE_ORDER_MARK,
  MAX_PRINTED_DIAGNOSTICS,
  type SkipReason,
} from '../constants.ts';
import type { Command } from '../schemas/command.ts';
import { rankRelationships, type CompanyRelationships } from './analyze.ts';
import { Network, type NameReference, type NetworkCounts } from './network.ts';
import { parseLine, wordPositionOf } from './parse.ts';

/** A problem with one input line. The line was skipped. */
export interface Diagnostic {
  /** 1-based, counting every line including blanks and comments. */
  line: number;
  /** The input line as written, minus a trailing carriage return or BOM. */
  text: string;
  message: string;
  reason: SkipReason;
  /** 0-based positions of the words at fault, for pointing at them. */
  words: number[];
  /** Extra context found later in the file, e.g. a late declaration. */
  notes: string[];
}

export interface PipelineOptions {
  /** Stop at the first invalid line instead of skipping it. */
  strict?: boolean;
}

export interface PipelineResult {
  report: CompanyRelationships[];
  /**
   * The first MAX_PRINTED_DIAGNOSTICS skipped lines, in input order, with
   * full details. Later ones are only counted, so memory stays flat however
   * many lines are bad.
   */
  diagnostics: Diagnostic[];
  /** Every skipped line, including those past `diagnostics`. */
  skippedCount: number;
  /** Every skipped line, by reason. */
  skippedByReason: Partial<Record<SkipReason, number>>;
  /** Every line read, including blanks and comments. */
  lineCount: number;
  /** Blank and `#` comment lines. */
  ignoredLineCount: number;
  /** Lines that produced a valid, applied command. */
  commandCount: number;
  /** What the network ended up holding. */
  counts: NetworkCounts;
  /** True when --strict stopped processing early; `report` is then empty. */
  aborted: boolean;
}

const referenceKey = ({ kind, name }: NameReference): string =>
  `${kind}:${name}`;

/** The name a command declares, if it's a declaration at all. */
function declaredName(command: Command): NameReference | undefined {
  if (command.kind === 'contact') return undefined;
  return { kind: command.kind, name: command.name };
}

function cleanLine(rawLine: string): string {
  const withoutBom = rawLine.startsWith(BYTE_ORDER_MARK)
    ? rawLine.slice(1)
    : rawLine;
  return withoutBom.replace(/\r$/, '');
}

/**
 * Runs every line through parse → network, then ranks the result. Takes any
 * iterable of lines, so the CLI can stream a file of any size and tests can
 * pass a plain array.
 *
 * When a line is skipped because it used a name that wasn't declared yet, and
 * that name is declared further down, the diagnostic gets a note pointing at
 * the later line: the usual fix is moving that declaration up.
 */
export async function analyzeLines(
  lines: AsyncIterable<string> | Iterable<string>,
  { strict = false }: PipelineOptions = {},
): Promise<PipelineResult> {
  const network = new Network();
  const diagnostics: Diagnostic[] = [];
  const skippedByReason: Partial<Record<SkipReason, number>> = {};
  const waitingForDeclaration = new Map<string, Diagnostic[]>();
  let skippedCount = 0;
  let commandCount = 0;
  let ignoredLineCount = 0;
  let lineNumber = 0;

  // Only the first MAX_PRINTED_DIAGNOSTICS problems are ever printed, so only
  // they keep their details (and get the slower "did you mean" lookups).
  const keepsDetails = (): boolean =>
    diagnostics.length < MAX_PRINTED_DIAGNOSTICS;
  const countSkip = (reason: SkipReason): void => {
    skippedCount += 1;
    skippedByReason[reason] = (skippedByReason[reason] ?? 0) + 1;
  };

  for await (const rawLine of lines) {
    lineNumber += 1;
    const parsed = parseLine(rawLine);
    if (parsed.status === 'skip') {
      ignoredLineCount += 1;
      continue;
    }

    if (parsed.status === 'error') {
      if (keepsDetails()) {
        diagnostics.push({
          line: lineNumber,
          text: cleanLine(rawLine),
          message: parsed.message,
          reason: parsed.reason,
          words: parsed.words,
          notes: [],
        });
      }
      countSkip(parsed.reason);
      if (strict) break;
      continue;
    }

    const { command } = parsed;
    const problem = network.apply(command, { suggestNames: keepsDetails() });

    if (problem === undefined) {
      commandCount += 1;
      const declared = declaredName(command);
      if (declared !== undefined) {
        const key = referenceKey(declared);
        for (const earlier of waitingForDeclaration.get(key) ?? []) {
          earlier.notes.push(
            `"${declared.name}" is declared later, on line ${lineNumber}; declarations must come before the lines that use them`,
          );
        }
        waitingForDeclaration.delete(key);
      }
      continue;
    }

    if (keepsDetails()) {
      const diagnostic: Diagnostic = {
        line: lineNumber,
        text: cleanLine(rawLine),
        message: problem.message,
        reason: problem.reason,
        words: problem.fields
          .map((field) => wordPositionOf(command.kind, field))
          .filter((position) => position !== undefined),
        notes: [],
      };
      diagnostics.push(diagnostic);

      for (const reference of problem.undeclared) {
        const key = referenceKey(reference);
        const waiting = waitingForDeclaration.get(key) ?? [];
        waiting.push(diagnostic);
        waitingForDeclaration.set(key, waiting);
      }
    }
    countSkip(problem.reason);
    if (strict) break;
  }

  const aborted = strict && skippedCount > 0;
  return {
    report: aborted ? [] : rankRelationships(network),
    diagnostics,
    skippedCount,
    skippedByReason,
    lineCount: lineNumber,
    ignoredLineCount,
    commandCount,
    counts: network.counts,
    aborted,
  };
}
