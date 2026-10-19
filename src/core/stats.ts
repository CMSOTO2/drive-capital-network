import {
  SKIP_REASON_CODES,
  SKIP_REASONS,
  type SkipReason,
} from '../constants.ts';
import type { ContactType } from '../schemas/command.ts';
import type { PipelineResult } from './pipeline.ts';

/** A summary of one run, for `--stats`. Counts only, never names. */
export interface RunStats {
  lines: {
    read: number;
    commands: number;
    skipped: number;
    /** Blank lines and `#` comments. */
    ignored: number;
  };
  partners: number;
  companies: {
    total: number;
    withRelationship: number;
    withoutRelationship: number;
  };
  employees: number;
  contacts: {
    total: number;
    byType: Record<ContactType, number>;
  };
  /** Skipped lines per reason, most common first. */
  skipped: { reason: SkipReason; label: string; count: number }[];
}

function skipsByReason(result: PipelineResult): RunStats['skipped'] {
  return SKIP_REASON_CODES.flatMap((reason) => {
    const count = result.skippedByReason[reason] ?? 0;
    return count === 0 ? [] : [{ reason, label: SKIP_REASONS[reason], count }];
  }).toSorted((a, b) => {
    if (a.count !== b.count) return b.count - a.count;
    return a.label.localeCompare(b.label);
  });
}

export function summarize(result: PipelineResult): RunStats {
  const { counts } = result;
  const contactTotal = Object.values(counts.contactsByType).reduce(
    (sum, count) => sum + count,
    0,
  );

  return {
    lines: {
      read: result.lineCount,
      commands: result.commandCount,
      skipped: result.skippedCount,
      ignored: result.ignoredLineCount,
    },
    partners: counts.partners,
    companies: {
      total: counts.companies,
      withRelationship: counts.companiesWithContacts,
      withoutRelationship: counts.companies - counts.companiesWithContacts,
    },
    employees: counts.employees,
    contacts: { total: contactTotal, byType: counts.contactsByType },
    skipped: skipsByReason(result),
  };
}
