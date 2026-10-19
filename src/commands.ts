import { z } from 'zod';

/** A word is one or more ASCII letters, per the prompt. */
export const NAME_PATTERN = /^[A-Za-z]+$/;

export const CONTACT_TYPES = ['email', 'call', 'coffee'] as const;

/** Joins items as `a, b, or c`. */
export const formatList = (items: readonly string[]): string =>
  items.length > 1
    ? `${items.slice(0, -1).join(', ')}, or ${items.at(-1)}`
    : items.join('');

const nameSchema = (label: string) =>
  z.string().regex(NAME_PATTERN, {
    error: (issue) =>
      `${label} "${String(issue.input)}" must contain only letters A-Z or a-z`,
  });

/** Finds a candidate that differs from `word` only by letter case. */
export const findCaseMismatch = (
  word: string,
  candidates: readonly string[],
): string | undefined =>
  candidates.find(
    (candidate) =>
      candidate !== word && candidate.toLowerCase() === word.toLowerCase(),
  );

export const ContactTypeSchema = z.enum(CONTACT_TYPES, {
  error: (issue) => {
    const input = String(issue.input);
    const hint = findCaseMismatch(input, CONTACT_TYPES);
    return hint
      ? `contact type "${input}" is not valid (did you mean "${hint}"?)`
      : `contact type "${input}" is not one of ${formatList(CONTACT_TYPES)}`;
  },
});

export const PartnerCommandSchema = z.object({
  kind: z.literal('partner'),
  name: nameSchema('partner name'),
});

export const CompanyCommandSchema = z.object({
  kind: z.literal('company'),
  name: nameSchema('company name'),
});

export const EmployeeCommandSchema = z.object({
  kind: z.literal('employee'),
  name: nameSchema('employee name'),
  company: nameSchema('company name'),
});

export const ContactCommandSchema = z.object({
  kind: z.literal('contact'),
  employee: nameSchema('employee name'),
  partner: nameSchema('partner name'),
  type: ContactTypeSchema,
});

export const CommandSchema = z.discriminatedUnion('kind', [
  PartnerCommandSchema,
  CompanyCommandSchema,
  EmployeeCommandSchema,
  ContactCommandSchema,
]);

export type ContactType = z.infer<typeof ContactTypeSchema>;
export type PartnerCommand = z.infer<typeof PartnerCommandSchema>;
export type CompanyCommand = z.infer<typeof CompanyCommandSchema>;
export type EmployeeCommand = z.infer<typeof EmployeeCommandSchema>;
export type ContactCommand = z.infer<typeof ContactCommandSchema>;
export type Command = z.infer<typeof CommandSchema>;

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
  { kind: Command['kind']; fields: readonly string[]; usage: string }
>;

export type Keyword = keyof typeof COMMAND_SYNTAX;

export const KEYWORDS = Object.keys(COMMAND_SYNTAX) as Keyword[];
