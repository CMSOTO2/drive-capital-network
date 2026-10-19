import { z } from 'zod';

import { OUTPUT_FORMATS } from '../constants.ts';
import { formatList } from '../utils/text.ts';
import { nameSchema } from './command.ts';

/** Validated command-line options, after argv has been tokenized. */
export const CliOptionsSchema = z.object({
  help: z.boolean().default(false),
  version: z.boolean().default(false),
  strict: z.boolean().default(false),
  quiet: z.boolean().default(false),
  /** `undefined` means "decide from the terminal and NO_COLOR". */
  color: z.boolean().optional(),
  format: z
    .enum(OUTPUT_FORMATS, {
      error: (issue) =>
        `--format must be ${formatList(OUTPUT_FORMATS)}, got "${String(issue.input)}"`,
    })
    .default('text'),
  /** Companies to report on; empty means all of them. */
  company: z.array(nameSchema('--company')).default([]),
  details: z.boolean().default(false),
  stats: z.boolean().default(false),
  /** Input file path; `undefined` means STDIN. */
  file: z.string().min(1, { error: 'input file path is empty' }).optional(),
});

export type CliOptions = z.infer<typeof CliOptionsSchema>;
