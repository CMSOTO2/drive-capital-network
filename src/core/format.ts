import { NO_RELATIONSHIP } from '../constants.ts';
import { strongestPartner, type CompanyRelationships } from './analyze.ts';

/** `<Company>: <Partner> (<strength>)` or `<Company>: No current relationship`. */
export function formatLine(relationships: CompanyRelationships): string {
  const best = strongestPartner(relationships);
  return best
    ? `${relationships.company}: ${best.partner} (${best.strength})`
    : `${relationships.company}: ${NO_RELATIONSHIP}`;
}

/** The report the prompt asks for: one line per company, newline-terminated. */
export function formatTextReport(report: CompanyRelationships[]): string {
  return report.map((line) => `${formatLine(line)}\n`).join('');
}

/**
 * The same report as JSON for other tools. `partner` and `strength` mirror the
 * text output; `partners` adds the full ranking behind it.
 */
export function formatJsonReport(report: CompanyRelationships[]): string {
  const rows = report.map((relationships) => {
    const best = strongestPartner(relationships);
    return {
      company: relationships.company,
      partner: best?.partner ?? null,
      strength: best?.strength ?? 0,
      partners: relationships.partners,
    };
  });
  return `${JSON.stringify(rows, null, 2)}\n`;
}
