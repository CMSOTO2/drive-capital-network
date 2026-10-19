import { z } from 'zod';

import { CONTACT_TYPES, NAME_PATTERN } from '../constants.ts';
import { didYouMean, suggest } from '../utils/suggest.ts';
import { formatList } from '../utils/text.ts';

/** A name made of letters only; `label` says what kind of name in errors. */
export const nameSchema = (label: string) =>
  z.string().regex(NAME_PATTERN, {
    error: (issue) =>
      `${label} "${String(issue.input)}" must contain only letters A-Z or a-z`,
  });

export const ContactTypeSchema = z.enum(CONTACT_TYPES, {
  error: (issue) => {
    const input = String(issue.input);
    const hint = suggest(input, CONTACT_TYPES);
    return hint
      ? `contact type "${input}" is not valid${didYouMean(hint)}`
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
