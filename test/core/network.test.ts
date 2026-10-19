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
      expect(network.apply(employee('Sarah', 'Initech'))?.message).toBe(
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
      expect(network.apply(employee('Sarah', 'ACME'))?.message).toBe(
        'employee "Sarah" is already declared at "Hooli"; employee names are unique, so "ACME" is ignored',
      );

      network.apply(contact('Sarah', 'Chris'));
      expect(strengths(network, 'Hooli')).toEqual({ Chris: 1 });
      expect(strengths(network, 'ACME')).toEqual({});
    });

    it('suggests a declared company with a similar name', () => {
      network.apply(company('ACME'));
      expect(network.apply(employee('Sam', 'Acmee'))?.message).toBe(
        'employee "Sam" works at company "Acmee", which hasn\'t been declared (did you mean "ACME"?)',
      );
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
      expect(network.apply(contact('Ollie', 'Chris'))?.message).toBe(
        'contact skipped: employee "Ollie" hasn\'t been declared',
      );
    });

    it('skips a contact with an undeclared partner', () => {
      expect(network.apply(contact('Laurie', 'Masha'))?.message).toBe(
        'contact skipped: partner "Masha" hasn\'t been declared',
      );
      expect(strengths(network, 'Globex')).toEqual({});
    });

    it('suggests a declared employee or partner with a similar name', () => {
      expect(network.apply(contact('Lauri', 'Chriss'))?.message).toBe(
        'contact skipped: employee "Lauri" hasn\'t been declared (did you mean "Laurie"?) and partner "Chriss" hasn\'t been declared (did you mean "Chris"?)',
      );
    });

    it('spots an employee and partner given in the wrong order', () => {
      expect(network.apply(contact('Chris', 'Laurie', 'call'))?.message).toBe(
        'contact skipped: "Chris" is a partner and "Laurie" is an employee; the order is Contact Laurie Chris call',
      );
    });

    it('names both problems when employee and partner are undeclared', () => {
      expect(network.apply(contact('Ollie', 'Masha'))?.message).toBe(
        'contact skipped: employee "Ollie" hasn\'t been declared and partner "Masha" hasn\'t been declared',
      );
    });

    it('does not resolve forward references: declarations must come first', () => {
      expect(network.apply(contact('Laurie', 'Rezzan'))).toBeDefined();
      network.apply(partner('Rezzan'));
      expect(strengths(network, 'Globex')).toEqual({});
    });
  });

  describe('problem details', () => {
    beforeEach(() => {
      applyAll([partner('Chris'), company('ACME'), employee('Sam', 'ACME')]);
    });

    it('names the fields at fault and the undeclared names', () => {
      expect(network.apply(contact('Ghost', 'Masha'))).toMatchObject({
        fields: ['employee', 'partner'],
        undeclared: [
          { kind: 'employee', name: 'Ghost' },
          { kind: 'partner', name: 'Masha' },
        ],
      });
    });

    it('reports an undeclared company on an employee', () => {
      expect(network.apply(employee('Ann', 'Initech'))).toMatchObject({
        fields: ['company'],
        undeclared: [{ kind: 'company', name: 'Initech' }],
      });
    });

    it('has nothing undeclared for a redeclared employee', () => {
      network.apply(company('Hooli'));
      expect(network.apply(employee('Sam', 'Hooli'))).toMatchObject({
        fields: ['company'],
        undeclared: [],
      });
    });
  });

  it('counts what it holds', () => {
    applyAll([
      partner('Chris'),
      partner('Molly'),
      company('ACME'),
      company('Hooli'),
      employee('Sam', 'ACME'),
      contact('Sam', 'Chris', 'coffee'),
      contact('Sam', 'Molly', 'coffee'),
      contact('Sam', 'Chris', 'email'),
      contact('Ghost', 'Chris', 'call'),
    ]);
    expect(network.counts).toEqual({
      partners: 2,
      companies: 2,
      companiesWithContacts: 1,
      employees: 1,
      contactsByType: { email: 1, call: 0, coffee: 2 },
    });
  });

  it('returns an empty map for a company with no contacts', () => {
    network.apply(company('ACME'));
    expect(network.strengthsFor('ACME').size).toBe(0);
    expect(network.strengthsFor('Unknown').size).toBe(0);
  });
});
