import { BYTE_ORDER_MARK } from '../constants.ts';
import type { Command } from '../schemas/command.ts';
import { rankRelationships, type CompanyRelationships } from './analyze.ts';
import { Network, type NameReference } from './network.ts';
import { parseLine, wordPositionOf } from './parse.ts';

/** A problem with one input line. The line was skipped. */
export interface Diagnostic {
  /** 1-based, counting every line including blanks and comments. */
  line: number;
  /** The input line as written, minus a trailing carriage return or BOM. */
  text: string;
  message: string;
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
  diagnostics: Diagnostic[];
  /** Lines that produced a valid, applied command. */
  commandCount: number;
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
  const waitingForDeclaration = new Map<string, Diagnostic[]>();
  let commandCount = 0;
  let lineNumber = 0;

  for await (const rawLine of lines) {
    lineNumber += 1;
    const parsed = parseLine(rawLine);
    if (parsed.status === 'skip') continue;

    if (parsed.status === 'error') {
      diagnostics.push({
        line: lineNumber,
        text: cleanLine(rawLine),
        message: parsed.message,
        words: parsed.words,
        notes: [],
      });
      if (strict) break;
      continue;
    }

    const { command } = parsed;
    const problem = network.apply(command);

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

    const diagnostic: Diagnostic = {
      line: lineNumber,
      text: cleanLine(rawLine),
      message: problem.message,
      words: problem.fields
        .map((field) => wordPositionOf(command.kind, field))
        .filter((position) => position !== undefined),
      notes: [],
    };
    diagnostics.push(diagnostic);
    if (strict) break;

    for (const reference of problem.undeclared) {
      const key = referenceKey(reference);
      const waiting = waitingForDeclaration.get(key) ?? [];
      waiting.push(diagnostic);
      waitingForDeclaration.set(key, waiting);
    }
  }

  const aborted = strict && diagnostics.length > 0;
  return {
    report: aborted ? [] : rankRelationships(network),
    diagnostics,
    commandCount,
    aborted,
  };
}
