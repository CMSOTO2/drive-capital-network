import { describe, expect, it } from 'vitest';

import { CommandSchema, ContactTypeSchema } from '../../src/schemas/command.ts';

describe('CommandSchema', () => {
  it('accepts each command shape', () => {
    for (const command of [
      { kind: 'partner', name: 'Chris' },
      { kind: 'company', name: 'ACME' },
      { kind: 'employee', name: 'Laurie', company: 'Globex' },
      { kind: 'contact', employee: 'Laurie', partner: 'Chris', type: 'call' },
    ]) {
      expect(CommandSchema.parse(command)).toEqual(command);
    }
  });

  it('rejects an unknown kind', () => {
    expect(
      CommandSchema.safeParse({ kind: 'investor', name: 'X' }).success,
    ).toBe(false);
  });

  it('rejects a missing field', () => {
    expect(
      CommandSchema.safeParse({ kind: 'employee', name: 'Laurie' }).success,
    ).toBe(false);
  });

  it('rejects an empty name', () => {
    expect(CommandSchema.safeParse({ kind: 'partner', name: '' }).success).toBe(
      false,
    );
  });
});

describe('ContactTypeSchema', () => {
  it.each(['email', 'call', 'coffee'])('accepts %s', (type) => {
    expect(ContactTypeSchema.parse(type)).toBe(type);
  });

  it.each(['text', 'EMAIL', ''])('rejects %j', (type) => {
    expect(ContactTypeSchema.safeParse(type).success).toBe(false);
  });
});
