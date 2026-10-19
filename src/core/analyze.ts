import { compareNames } from '../utils/text.ts';
import type { Network } from './network.ts';

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
export function rankRelationships(network: Network): CompanyRelationships[] {
  return [...network.companies].toSorted(compareNames).map((company) => ({
    company,
    partners: [...network.strengthsFor(company)]
      .map(([partner, strength]) => ({ partner, strength }))
      .toSorted(byStrengthThenName),
  }));
}

/** The partner with the strongest relationship, if anyone has one. */
export const strongestPartner = ({
  partners,
}: CompanyRelationships): PartnerStrength | undefined => partners[0];
