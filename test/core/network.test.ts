import { beforeEach, describe, expect, it } from 'vitest';

import { Network } from '../../src/core/network.ts';
import type { Command } from '../../src/schemas/command.ts';

const partner = (name: string): Command => ({ kind: 'partner', name });
const company = (name: string): Command => ({ kind: 'company', name });
const employee = (name: string, at: string): Command => ({
  kind: 'employee',
  name,
  company: at,
});
const contact = (
  employeeName: string,
  partnerName: string,
  type: 'email' | 'call' | 'coffee' = 'email',
): Command => ({
  kind: 'contact',
  employee: employeeName,
  partner: partnerName,
  type,
});

const strengths = (network: Network, name: string) =>
  Object.fromEntries(network.strengthsFor(name));

describe('Network', () => {
  let network: Network;

  const applyAll = (commands: Command[]) =>
    commands.map((command) => network.apply(command));

  beforeEach(() => {
    network = new Network();
  });

  describe('declarations', () => {
    it('keeps companies in declaration order', () => {
      applyAll([company('Globex'), company('ACME'), company('Hooli')]);
      expect([...network.companies]).toEqual(['Globex', 'ACME', 'Hooli']);
    });

    it('treats a repeated Partner or Company declaration as a no-op', () => {
      const warnings = applyAll([
        partner('Chris'),
        partner('Chris'),
        company('ACME'),
        company('ACME'),
      ]);
      expect(warnings).toEqual([undefined, undefined, undefined, undefined]);
      expect([...network.companies]).toEqual(['ACME']);
    });

    it('accepts the same employee declared twice at the same company', () => {
      applyAll([company('ACME'), employee('Sarah', 'ACME')]);
      expect(network.apply(employee('Sarah', 'ACME'))).toBeUndefined();
    });

    it('rejects an employee at an undeclared company', () => {
      expect(network.apply(employee('Sarah', 'Initech'))).toBe(
        'employee "Sarah" works at company "Initech", which hasn\'t been declared',
      );
    });

    it('keeps the first company when an employee is redeclared elsewhere', () => {
      applyAll([
        partner('Chris'),
        company('Hooli'),
        company('ACME'),
        employee('Sarah', 'Hooli'),
      ]);
      expect(network.apply(employee('Sarah', 'ACME'))).toBe(
        'employee "Sarah" is already declared at "Hooli"; employee names are unique, so "ACME" is ignored',
      );

      network.apply(contact('Sarah', 'Chris'));
      expect(strengths(network, 'Hooli')).toEqual({ Chris: 1 });
      expect(strengths(network, 'ACME')).toEqual({});
    });

    it('keeps partners and employees in separate namespaces', () => {
      applyAll([
        partner('Alex'),
        company('ACME'),
        employee('Alex', 'ACME'),
        contact('Alex', 'Alex'),
      ]);
      expect(strengths(network, 'ACME')).toEqual({ Alex: 1 });
    });
  });

  describe('contacts', () => {
    beforeEach(() => {
      applyAll([
        partner('Chris'),
        partner('Molly'),
        company('Globex'),
        company('Hooli'),
        employee('Laurie', 'Globex'),
        employee('Jamie', 'Globex'),
        employee('Abdi', 'Hooli'),
      ]);
    });

    it('sums contacts across every employee of a company', () => {
      applyAll([
        contact('Laurie', 'Chris', 'email'),
        contact('Jamie', 'Chris', 'call'),
        contact('Laurie', 'Molly', 'coffee'),
      ]);
      expect(strengths(network, 'Globex')).toEqual({ Chris: 2, Molly: 1 });
      expect(strengths(network, 'Hooli')).toEqual({});
    });

    it('counts every contact type as 1', () => {
      applyAll([
        contact('Abdi', 'Molly', 'email'),
        contact('Abdi', 'Molly', 'call'),
        contact('Abdi', 'Molly', 'coffee'),
      ]);
      expect(strengths(network, 'Hooli')).toEqual({ Molly: 3 });
    });

    it('counts repeated identical contacts separately', () => {
      applyAll([contact('Abdi', 'Molly'), contact('Abdi', 'Molly')]);
      expect(strengths(network, 'Hooli')).toEqual({ Molly: 2 });
    });

    it('skips a contact with an undeclared employee', () => {
      expect(network.apply(contact('Ollie', 'Chris'))).toBe(
        'contact skipped: employee "Ollie" hasn\'t been declared',
      );
    });

    it('skips a contact with an undeclared partner', () => {
      expect(network.apply(contact('Laurie', 'Masha'))).toBe(
        'contact skipped: partner "Masha" hasn\'t been declared',
      );
      expect(strengths(network, 'Globex')).toEqual({});
    });

    it('names both problems when employee and partner are undeclared', () => {
      expect(network.apply(contact('Ollie', 'Masha'))).toBe(
        'contact skipped: employee "Ollie" hasn\'t been declared and partner "Masha" hasn\'t been declared',
      );
    });

    it('does not resolve forward references: declarations must come first', () => {
      expect(network.apply(contact('Laurie', 'Rezzan'))).toBeDefined();
      network.apply(partner('Rezzan'));
      expect(strengths(network, 'Globex')).toEqual({});
    });
  });

  it('returns an empty map for a company with no contacts', () => {
    network.apply(company('ACME'));
    expect(network.strengthsFor('ACME').size).toBe(0);
    expect(network.strengthsFor('Unknown').size).toBe(0);
  });
});
