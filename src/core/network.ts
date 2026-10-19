import {
  CONTACT_TYPES,
  type CommandKind,
  type SkipReason,
} from '../constants.ts';
import type {
  Command,
  CompanyCommand,
  ContactCommand,
  ContactType,
  EmployeeCommand,
  PartnerCommand,
} from '../schemas/command.ts';
import { didYouMean, suggest } from '../utils/suggest.ts';

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

/**
 * Everything Herbie knows about Drive's network, reduced to what the report
 * needs: who exists, where each employee works, and how many contacts each
 * partner has had with each company.
 *
 * Contacts are counted as they arrive instead of being stored, so memory grows
 * with the number of company/partner pairs, not the number of contacts.
 */
export class Network {
  readonly #partners = new Set<string>();
  readonly #companies = new Set<string>();
  readonly #employeeCompany = new Map<string, string>();
  readonly #strength = new Map<string, Map<string, number>>();
  readonly #contactsByType = new Map<ContactType, number>();

  /**
   * Applies one command in input order. Returns a problem when the command
   * refers to something that hasn't been declared or contradicts an earlier
   * declaration; in that case the network is left unchanged.
   */
  apply(command: Command): Problem | undefined {
    switch (command.kind) {
      case 'partner':
        return this.#addPartner(command);
      case 'company':
        return this.#addCompany(command);
      case 'employee':
        return this.#addEmployee(command);
      case 'contact':
        return this.#addContact(command);
    }
  }

  /** Every declared company, in declaration order. */
  get companies(): ReadonlySet<string> {
    return this.#companies;
  }

  /** Contact counts per partner for one company; empty when there are none. */
  strengthsFor(company: string): ReadonlyMap<string, number> {
    return this.#strength.get(company) ?? new Map();
  }

  get counts(): NetworkCounts {
    const contactsByType = Object.fromEntries(
      CONTACT_TYPES.map((type) => [type, this.#contactsByType.get(type) ?? 0]),
    ) as Record<ContactType, number>;
    return {
      partners: this.#partners.size,
      companies: this.#companies.size,
      companiesWithContacts: this.#strength.size,
      employees: this.#employeeCompany.size,
      contactsByType,
    };
  }

  #addPartner({ name }: PartnerCommand): undefined {
    this.#partners.add(name);
  }

  #addCompany({ name }: CompanyCommand): undefined {
    this.#companies.add(name);
  }

  #addEmployee({ name, company }: EmployeeCommand): Problem | undefined {
    if (!this.#companies.has(company)) {
      const hint = didYouMean(suggest(company, this.#companies));
      return {
        message: `employee "${name}" works at company "${company}", which hasn't been declared${hint}`,
        reason: 'undeclaredName',
        fields: ['company'],
        undeclared: [{ kind: 'company', name: company }],
      };
    }

    const currentCompany = this.#employeeCompany.get(name);
    if (currentCompany !== undefined && currentCompany !== company) {
      return {
        message: `employee "${name}" is already declared at "${currentCompany}"; employee names are unique, so "${company}" is ignored`,
        reason: 'employeeRedeclared',
        fields: ['company'],
        undeclared: [],
      };
    }

    this.#employeeCompany.set(name, company);
    return undefined;
  }

  #addContact({
    employee,
    partner,
    type,
  }: ContactCommand): Problem | undefined {
    const company = this.#employeeCompany.get(employee);
    const partnerIsDeclared = this.#partners.has(partner);

    if (company !== undefined && partnerIsDeclared) {
      this.#countContact(company, partner, type);
      return undefined;
    }

    // `Contact Chris Laurie` where Chris is a partner and Laurie an employee:
    // the line would be valid with the two names the other way round.
    const namesAreSwapped =
      this.#partners.has(employee) && this.#employeeCompany.has(partner);
    if (namesAreSwapped) {
      return {
        message: `contact skipped: "${employee}" is a partner and "${partner}" is an employee; the order is Contact ${partner} ${employee} ${type}`,
        reason: 'swappedArguments',
        fields: ['employee', 'partner'],
        undeclared: [],
      };
    }

    const reasons: string[] = [];
    const fields: string[] = [];
    const undeclared: NameReference[] = [];

    if (company === undefined) {
      const hint = didYouMean(suggest(employee, this.#employeeCompany.keys()));
      reasons.push(`employee "${employee}" hasn't been declared${hint}`);
      fields.push('employee');
      undeclared.push({ kind: 'employee', name: employee });
    }
    if (!partnerIsDeclared) {
      const hint = didYouMean(suggest(partner, this.#partners));
      reasons.push(`partner "${partner}" hasn't been declared${hint}`);
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

  #countContact(company: string, partner: string, type: ContactType): void {
    this.#contactsByType.set(type, (this.#contactsByType.get(type) ?? 0) + 1);

    let counts = this.#strength.get(company);
    if (counts === undefined) {
      counts = new Map();
      this.#strength.set(company, counts);
    }
    counts.set(partner, (counts.get(partner) ?? 0) + 1);
  }
}
