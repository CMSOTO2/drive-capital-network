/** A word is one or more ASCII letters, per the prompt. */
export const NAME_PATTERN = /^[A-Za-z]+$/;

export const CONTACT_TYPES = ['email', 'call', 'coffee'] as const;

export const COMMAND_KINDS = [
  'partner',
  'company',
  'employee',
  'contact',
] as const;

export type CommandKind = (typeof COMMAND_KINDS)[number];

/**
 * How each input keyword maps to a command: the field each word fills, in
 * order, and the usage shown when the word count is wrong.
 */
export const COMMAND_SYNTAX = {
  Partner: { kind: 'partner', fields: ['name'], usage: 'Partner <Name>' },
  Company: { kind: 'company', fields: ['name'], usage: 'Company <Name>' },
  Employee: {
    kind: 'employee',
    fields: ['name', 'company'],
    usage: 'Employee <Name> <CompanyName>',
  },
  Contact: {
    kind: 'contact',
    fields: ['employee', 'partner', 'type'],
    usage: `Contact <EmployeeName> <PartnerName> <${CONTACT_TYPES.join('|')}>`,
  },
} as const satisfies Record<
  string,
  { kind: CommandKind; fields: readonly string[]; usage: string }
>;

export type Keyword = keyof typeof COMMAND_SYNTAX;

export const KEYWORDS = Object.keys(COMMAND_SYNTAX) as Keyword[];

/** Some Windows editors put this invisible character at the start of a file. */
export const BYTE_ORDER_MARK = '\uFEFF';

export const COMMENT_PREFIX = '#';

/** The output line for a company nobody at Drive has contacted. */
export const NO_RELATIONSHIP = 'No current relationship';

export const OUTPUT_FORMATS = ['text', 'json'] as const;

export type OutputFormat = (typeof OUTPUT_FORMATS)[number];

export const EXIT_CODES = {
  ok: 0,
  /** The input can't answer the request: an invalid line with --strict, or a --company that isn't in it. */
  inputProblem: 1,
  /** Bad flags, unreadable file, or no input at all. */
  usage: 2,
} as const;

/** Warnings shown before the rest are summarized as "…and N more". */
export const MAX_PRINTED_DIAGNOSTICS = 20;

/** Argument meaning "read from STDIN", as in `cat file | analyze-network -`. */
export const STDIN_ARG = '-';

/**
 * "Did you mean" tolerance by word length. Words of 1–2 letters only match
 * when the case differs, 3–4 letters allow one edit, longer words two.
 */
export const SUGGESTION_EDIT_LIMITS = [
  { maxLength: 2, edits: 0 },
  { maxLength: 4, edits: 1 },
] as const;

export const SUGGESTION_MAX_EDITS = 2;

/** Why a line was skipped, with the label used in `--stats`. */
export const SKIP_REASONS = {
  unknownCommand: 'unknown command',
  wrongWordCount: 'wrong word count',
  invalidName: 'invalid name',
  invalidContactType: 'invalid contact type',
  undeclaredName: 'undeclared name',
  swappedArguments: 'swapped contact arguments',
  employeeRedeclared: 'employee redeclared',
} as const;

export type SkipReason = keyof typeof SKIP_REASONS;

export const SKIP_REASON_CODES = Object.keys(SKIP_REASONS) as SkipReason[];
