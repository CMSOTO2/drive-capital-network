import { possibleMatches } from '../utils/suggest.ts';
import { compareNames } from '../utils/text.ts';
import { strengthsFor, type NetworkView } from './network.ts';

export interface PartnerStrength {
  partner: string;
  /** Total contacts between this partner and the company's employees. */
  strength: number;
}

export interface CompanyRelationships {
  company: string;
  /** Strongest first; ties broken alphabetically. Empty if nobody has contact. */
  partners: PartnerStrength[];
}

/** Strongest first; equal strengths fall back to alphabetical order. */
function byStrengthThenName(a: PartnerStrength, b: PartnerStrength): number {
  if (a.strength !== b.strength) return b.strength - a.strength;
  return compareNames(a.partner, b.partner);
}

/**
 * Ranks every partner's relationship to every company. Companies are sorted
 * alphabetically; partners with zero contacts are left out.
 */
export function rankRelationships(
  network: NetworkView,
): CompanyRelationships[] {
  return [...network.companies].toSorted(compareNames).map((company) => ({
    company,
    partners: [...strengthsFor(network, company)]
      .map(([partner, strength]) => ({ partner, strength }))
      .toSorted(byStrengthThenName),
  }));
}

/** The partner with the strongest relationship, if anyone has one. */
export const strongestPartner = ({
  partners,
}: CompanyRelationships): PartnerStrength | undefined => partners[0];

export interface MissingCompany {
  name: string;
  /**
   * Companies in the report the name could mean, alphabetically: other
   * letter case, names it's the start of, or close spellings. Several
   * matches are all listed, so the user picks instead of the tool guessing.
   */
  matches: string[];
}

export interface CompanySelection {
  /** The requested companies that exist, in report (alphabetical) order. */
  selected: CompanyRelationships[];
  /** Requested names that aren't in the report, in the order requested. */
  missing: MissingCompany[];
}

/**
 * Narrows the report to the requested companies, for `--company`. Names must
 * match exactly, since `ACME` and `Acme` can be different companies; a near
 * miss is reported as missing, with every company it could mean. An empty
 * request selects every company.
 */
export function selectCompanies(
  report: CompanyRelationships[],
  requested: readonly string[],
): CompanySelection {
  if (requested.length === 0) {
    return { selected: report, missing: [] };
  }

  const wanted = new Set(requested);
  const selected = report.filter(({ company }) => wanted.has(company));

  const companyNames = report.map(({ company }) => company);
  const found = new Set(selected.map(({ company }) => company));
  const missing = [...wanted]
    .filter((name) => !found.has(name))
    .map((name) => ({ name, matches: possibleMatches(name, companyNames) }));

  return { selected, missing };
}
