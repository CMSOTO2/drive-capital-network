import { NO_RELATIONSHIP } from '../constants.ts';
import { strongestPartner, type CompanyRelationships } from './analyze.ts';

export interface TextOptions {
  /** List every partner's strength instead of only the strongest. */
  details?: boolean;
}

/**
 * One company's line:
 *
 * - `Globex: Chris (2)`: the strongest partner (the prompt's format)
 * - `Globex: Chris (2), Molly (1)`: every partner, with `details`
 * - `ACME: No current relationship`: nobody has contact
 */
export function formatLine(
  relationships: CompanyRelationships,
  { details = false }: TextOptions = {},
): string {
  const { company, partners } = relationships;
  const best = strongestPartner(relationships);
  if (best === undefined) {
    return `${company}: ${NO_RELATIONSHIP}`;
  }

  const shown = details ? partners : [best];
  const list = shown
    .map(({ partner, strength }) => `${partner} (${strength})`)
    .join(', ');
  return `${company}: ${list}`;
}

/** One line per company, each ending in a newline. */
export function formatTextReport(
  report: CompanyRelationships[],
  options: TextOptions = {},
): string {
  return report.map((line) => `${formatLine(line, options)}\n`).join('');
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
