import type {
  Command,
  CompanyCommand,
  ContactCommand,
  EmployeeCommand,
  PartnerCommand,
} from '../schemas/command.ts';

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

  /**
   * Applies one command in input order. Returns a warning when the command
   * refers to something that hasn't been declared or contradicts an earlier
   * declaration; in that case the network is left unchanged.
   */
  apply(command: Command): string | undefined {
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

  #addPartner({ name }: PartnerCommand): undefined {
    this.#partners.add(name);
  }

  #addCompany({ name }: CompanyCommand): undefined {
    this.#companies.add(name);
  }

  #addEmployee({ name, company }: EmployeeCommand): string | undefined {
    if (!this.#companies.has(company)) {
      return `employee "${name}" works at company "${company}", which hasn't been declared`;
    }
    const current = this.#employeeCompany.get(name);
    if (current !== undefined && current !== company) {
      return `employee "${name}" is already declared at "${current}"; employee names are unique, so "${company}" is ignored`;
    }
    this.#employeeCompany.set(name, company);
    return undefined;
  }

  #addContact({ employee, partner }: ContactCommand): string | undefined {
    const company = this.#employeeCompany.get(employee);
    const problems = [
      company === undefined && `employee "${employee}" hasn't been declared`,
      !this.#partners.has(partner) &&
        `partner "${partner}" hasn't been declared`,
    ].filter((problem) => problem !== false);
    if (company === undefined || problems.length > 0) {
      return `contact skipped: ${problems.join(' and ')}`;
    }

    let counts = this.#strength.get(company);
    if (counts === undefined) {
      counts = new Map();
      this.#strength.set(company, counts);
    }
    counts.set(partner, (counts.get(partner) ?? 0) + 1);
    return undefined;
  }
}
