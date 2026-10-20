import {
  BYTE_ORDER_MARK,
  COMMAND_SYNTAX,
  COMMENT_PREFIX,
  KEYWORDS,
  NAME_PATTERN,
  type CommandKind,
  type Keyword,
  type SkipReason,
} from '../constants.ts';
import { CommandSchema, type Command } from '../schemas/command.ts';
import { didYouMean, suggest } from '../utils/suggest.ts';
import { formatList, quote } from '../utils/text.ts';

export type ParseResult =
  | { status: 'skip' }
  | { status: 'ok'; command: Command }
  | {
      status: 'error';
      message: string;
      /** 0-based positions of the words at fault; the keyword is word 0. */
      words: number[];
      reason: SkipReason;
    };

const isKeyword = (word: string): word is Keyword =>
  Object.hasOwn(COMMAND_SYNTAX, word);

const failure = (
  message: string,
  words: number[],
  reason: SkipReason,
): ParseResult => ({ status: 'error', message, words, reason });

/**
 * Where a command's field sits on its line. In `Contact Laurie Chris call`,
 * `employee` is word 1 and `type` is word 3.
 */
export function wordPositionOf(
  kind: CommandKind,
  field: string,
): number | undefined {
  const syntax = Object.values(COMMAND_SYNTAX).find(
    (entry) => entry.kind === kind,
  );
  const index = syntax?.fields.findIndex((name) => name === field) ?? -1;
  return index === -1 ? undefined : index + 1;
}

function unknownCommand(word: string): ParseResult {
  const hint = suggest(word, KEYWORDS);
  const message = hint
    ? `unknown command ${quote(word)}${didYouMean(hint)}`
    : `unknown command ${quote(word)}; expected ${formatList(KEYWORDS)}`;
  return failure(message, [0], 'unknownCommand');
}

/**
 * For `Partner Chris Smith`: a full name where one word belongs. Only for the
 * commands that take a single name, where the extra words can't be anything
 * else; in `Contact Sam Chris call today` the extra word isn't part of a name.
 */
function fullNameHint(keyword: Keyword, args: readonly string[]): string {
  const takesOneName = COMMAND_SYNTAX[keyword].fields.length === 1;
  const allWordsAreNames = args.every((word) => NAME_PATTERN.test(word));
  if (!takesOneName || args.length < 2 || !allWordsAreNames) return '';
  return `; names are a single word${didYouMean(`${keyword} ${args.join('')}`)}`;
}

function wrongWordCount(
  keyword: Keyword,
  args: readonly string[],
): ParseResult {
  const { fields, usage } = COMMAND_SYNTAX[keyword];
  const expected = fields.length;
  const got = args.length;
  const noun = expected === 1 ? 'argument' : 'arguments';

  // Too many words: point at the extras. Too few: point at the keyword.
  const extraWords = Array.from(
    { length: got - expected },
    (_, index) => expected + 1 + index,
  );
  const words = got > expected ? extraWords : [0];

  return failure(
    `${keyword} expects ${expected} ${noun} but got ${got} (usage: ${usage})${fullNameHint(keyword, args)}`,
    words,
    'wrongWordCount',
  );
}

/**
 * Parses one input line into a validated command.
 *
 * Blank lines and `#` comments are skipped. Anything else that isn't a
 * well-formed command comes back as an error with a readable message and the
 * positions of the words at fault; this function never throws.
 */
export function parseLine(line: string): ParseResult {
  const withoutBom = line.startsWith(BYTE_ORDER_MARK) ? line.slice(1) : line;
  const text = withoutBom.trim();
  if (text === '' || text.startsWith(COMMENT_PREFIX)) {
    return { status: 'skip' };
  }

  const [keyword = '', ...args] = text.split(/\s+/);
  if (!isKeyword(keyword)) {
    return unknownCommand(keyword);
  }

  const { kind, fields } = COMMAND_SYNTAX[keyword];
  if (args.length !== fields.length) {
    return wrongWordCount(keyword, args);
  }

  // Pair each word with its field name, e.g. `Employee Laurie Globex` becomes
  // { kind: 'employee', name: 'Laurie', company: 'Globex' }, then let the
  // schema check the values.
  const candidate: Record<string, string> = { kind };
  fields.forEach((field, index) => {
    candidate[field] = args[index] ?? '';
  });

  const result = CommandSchema.safeParse(candidate);
  if (result.success) {
    return { status: 'ok', command: result.data };
  }

  const issues = result.error.issues;
  const words = issues
    .map((issue) => wordPositionOf(kind, String(issue.path[0])))
    .filter((position) => position !== undefined);
  // A line can have several issues; the first one decides the reason.
  const firstField = String(issues[0]?.path[0]);
  const reason = firstField === 'type' ? 'invalidContactType' : 'invalidName';
  return failure(
    issues.map((issue) => issue.message).join('; '),
    words,
    reason,
  );
}
