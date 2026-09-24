import { describe, expect, it } from 'vitest';
import { SCHEMA_SQL, SCHEMA_VERSION } from '../src/db/schema';

describe('accounting schema', () => {
  it('defines a schema version', () => {
    expect(SCHEMA_VERSION).toBeGreaterThan(0);
  });

  it('creates the core double-entry tables', () => {
    for (const table of ['accounts', 'journal_entries', 'journal_lines', 'transactions']) {
      expect(SCHEMA_SQL).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
  });

  it('constrains journal line amounts to positive integers (minor units)', () => {
    expect(SCHEMA_SQL).toMatch(/amount_minor INTEGER NOT NULL CHECK \(amount_minor > 0\)/);
  });
});
