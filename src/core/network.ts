import {
  CONTACT_TYPES,
  type CommandKind,
  type SkipReason,
} from '../constants.ts';
import type {
  Command,
  ContactCommand,
  ContactType,
  EmployeeCommand,
} from '../schemas/command.ts';
import { didYouMean, suggest } from '../utils/suggest.ts';
import { quote } from '../utils/text.ts';

/** A name of a partner, company, or employee that a command refers to. */
export interface NameReference {
  kind: Exclude<CommandKind, 'contact'>;
  name: string;
}

/** Why a command couldn't be applied. The network is left unchanged. */
export interface Problem {
  message: string;
  reason: SkipReason;
  /** The command fields at fault (e.g. `partner`), so the CLI can point at them. */
  fields: string[];
  /** Names that weren't declared yet; a later declaration can explain them. */
  undeclared: NameReference[];
}

/** How much the network holds, for `--stats`. */
export interface NetworkCounts {
  partners: number;
  companies: number;
  /** Companies with at least one contact. */
  companiesWithContacts: number;
  employees: number;
  contactsByType: Record<ContactType, number>;
}

export interface ApplyOptions {
  /**
   * Look up "did you mean" suggestions for undeclared names. Each lookup
   * compares against every declared name of that kind, so callers turn this
   * off for problems nobody will see. Defaults to true.
   */
  suggestNames?: boolean;
}

/**
 * Everything Herbie knows about Drive's network, reduced to what the report
 * needs: who exists, where each employee works, and how many contacts each
 * partner has had with each company.
 *
 * Plain data. Create one with `createNetwork`, and change it only through
 * `applyCommand`, which keeps the rules (a contact only counts once its
 * employee and partner exist). Code that only reads it takes a
 * `NetworkView`, so TypeScript stops it from changing anything.
 *
 * Contacts are counted as they arrive instead of being stored, so memory grows
 * with the number of company/partner pairs, not the number of contacts.
 */
export interface Network {
  partners: Set<string>;
  companies: Set<string>;
  /** Employee → the company they work at. Employee names are globally unique. */
  employeeCompany: Map<string, string>;
  /** Company → partner → contacts between them. */
  strength: Map<string, Map<string, number>>;
  contactsByType: Map<ContactType, number>;
}

/** A network as code that only reads it sees it. */
export interface NetworkView {
  readonly partners: ReadonlySet<string>;
  readonly companies: ReadonlySet<string>;
  readonly employeeCompany: ReadonlyMap<string, string>;
  readonly strength: ReadonlyMap<string, ReadonlyMap<string, number>>;
  readonly contactsByType: ReadonlyMap<ContactType, number>;
}

/** An empty network, ready for `applyCommand`. */
export function createNetwork(): Network {
  return {
    partners: new Set(),
    companies: new Set(),
    employeeCompany: new Map(),
    strength: new Map(),
    contactsByType: new Map(),
  };
}

/**
 * Applies one command, in input order. Returns a problem when the command
 * refers to something that hasn't been declared or contradicts an earlier
 * declaration; in that case the network is left unchanged.
 *
 * This is the only function that changes a network. It changes the one it's
 * given rather than returning a copy: copying the maps for every line would
 * be far too slow for a file with a million contacts.
 */
export function applyCommand(
  network: Network,
  command: Command,
  { suggestNames = true }: ApplyOptions = {},
): Problem | undefined {
  switch (command.kind) {
    case 'partner':
      network.partners.add(command.name);
      return undefined;
    case 'company':
      network.companies.add(command.name);
      return undefined;
    case 'employee':
      return addEmployee(network, command, suggestNames);
    case 'contact':
      return addContact(network, command, suggestNames);
  }
}

/** Contact counts per partner for one company; empty when there are none. */
export function strengthsFor(
  network: NetworkView,
  company: string,
): ReadonlyMap<string, number> {
  return network.strength.get(company) ?? new Map();
}

/** How much the network holds, for `--stats`. */
export function countNetwork(network: NetworkView): NetworkCounts {
  const contactsByType = Object.fromEntries(
    CONTACT_TYPES.map((type) => [type, network.contactsByType.get(type) ?? 0]),
  ) as Record<ContactType, number>;
  return {
    partners: network.partners.size,
    companies: network.companies.size,
    companiesWithContacts: network.strength.size,
    employees: network.employeeCompany.size,
    contactsByType,
  };
}

function addEmployee(
  network: Network,
  { name, company }: EmployeeCommand,
  suggestNames: boolean,
): Problem | undefined {
  if (!network.companies.has(company)) {
    const hint = suggestNames
      ? didYouMean(suggest(company, network.companies))
      : '';
    return {
      message: `employee ${quote(name)} works at company ${quote(company)}, which hasn't been declared${hint}`,
      reason: 'undeclaredName',
      fields: ['company'],
      undeclared: [{ kind: 'company', name: company }],
    };
  }

  const currentCompany = network.employeeCompany.get(name);
  if (currentCompany !== undefined && currentCompany !== company) {
    return {
      message: `employee ${quote(name)} is already declared at ${quote(currentCompany)}; employee names are unique, so ${quote(company)} is ignored`,
      reason: 'employeeRedeclared',
      fields: ['company'],
      undeclared: [],
    };
  }

  network.employeeCompany.set(name, company);
  return undefined;
}

function addContact(
  network: Network,
  { employee, partner, type }: ContactCommand,
  suggestNames: boolean,
): Problem | undefined {
  const company = network.employeeCompany.get(employee);
  const partnerIsDeclared = network.partners.has(partner);

  if (company !== undefined && partnerIsDeclared) {
    countContact(network, company, partner, type);
    return undefined;
  }

  // `Contact Chris Laurie` where Chris is a partner and Laurie an employee:
  // the line would be valid with the two names the other way round.
  const namesAreSwapped =
    network.partners.has(employee) && network.employeeCompany.has(partner);
  if (namesAreSwapped) {
    return {
      message: `contact skipped: ${quote(employee)} is a partner and ${quote(partner)} is an employee; the order is Contact ${partner} ${employee} ${type}`,
      reason: 'swappedArguments',
      fields: ['employee', 'partner'],
      undeclared: [],
    };
  }

  const reasons: string[] = [];
  const fields: string[] = [];
  const undeclared: NameReference[] = [];

  if (company === undefined) {
    const hint = suggestNames
      ? didYouMean(suggest(employee, network.employeeCompany.keys()))
      : '';
    reasons.push(`employee ${quote(employee)} hasn't been declared${hint}`);
    fields.push('employee');
    undeclared.push({ kind: 'employee', name: employee });
  }
  if (!partnerIsDeclared) {
    const hint = suggestNames
      ? didYouMean(suggest(partner, network.partners))
      : '';
    reasons.push(`partner ${quote(partner)} hasn't been declared${hint}`);
    fields.push('partner');
    undeclared.push({ kind: 'partner', name: partner });
  }

  return {
    message: `contact skipped: ${reasons.join(' and ')}`,
    reason: 'undeclaredName',
    fields,
    undeclared,
  };
}

function countContact(
  network: Network,
  company: string,
  partner: string,
  type: ContactType,
): void {
  network.contactsByType.set(type, (network.contactsByType.get(type) ?? 0) + 1);

  let counts = network.strength.get(company);
  if (counts === undefined) {
    counts = new Map();
    network.strength.set(company, counts);
  }
  counts.set(partner, (counts.get(partner) ?? 0) + 1);
}
