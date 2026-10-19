import {
  BYTE_ORDER_MARK,
  COMMAND_SYNTAX,
  COMMENT_PREFIX,
  KEYWORDS,
  type Keyword,
} from '../constants.ts';
import { CommandSchema, type Command } from '../schemas/command.ts';
import { findCaseMismatch, formatList } from '../utils/text.ts';

export type ParseResult =
  | { status: 'skip' }
  | { status: 'ok'; command: Command }
  | { status: 'error'; message: string };

const isKeyword = (word: string): word is Keyword =>
  Object.hasOwn(COMMAND_SYNTAX, word);

const failure = (message: string): ParseResult => ({
  status: 'error',
  message,
});

const unknownCommand = (word: string): ParseResult => {
  const hint = findCaseMismatch(word, KEYWORDS);
  return failure(
    hint
      ? `unknown command "${word}" (did you mean "${hint}"?)`
      : `unknown command "${word}"; expected ${formatList(KEYWORDS)}`,
  );
};

/**
 * Parses one input line into a validated command.
 *
 * Blank lines and `#` comments are skipped. Anything else that isn't a
 * well-formed command comes back as an error with a readable message; this
 * function never throws.
 */
export function parseLine(line: string): ParseResult {
  const text = (line.startsWith(BYTE_ORDER_MARK) ? line.slice(1) : line).trim();
  if (text === '' || text.startsWith(COMMENT_PREFIX)) {
    return { status: 'skip' };
  }

  const [keyword = '', ...args] = text.split(/\s+/);
  if (!isKeyword(keyword)) {
    return unknownCommand(keyword);
  }

  const { kind, fields, usage } = COMMAND_SYNTAX[keyword];
  if (args.length !== fields.length) {
    const expected = `${fields.length} ${fields.length === 1 ? 'argument' : 'arguments'}`;
    return failure(
      `${keyword} expects ${expected} but got ${args.length} (usage: ${usage})`,
    );
  }

  const candidate = Object.fromEntries([
    ['kind', kind],
    ...fields.map((field, index) => [field, args[index]]),
  ]);
  const result = CommandSchema.safeParse(candidate);
  if (!result.success) {
    return failure(
      result.error.issues.map((issue) => issue.message).join('; '),
    );
  }
  return { status: 'ok', command: result.data };
}
