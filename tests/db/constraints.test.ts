import initSqlJs, { type Database } from 'sql.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_SQL } from '../../src/db/schema';

let db: Database;

beforeEach(async () => {
  const SQL = await initSqlJs({
    locateFile: (file) => `${process.cwd()}/node_modules/sql.js/dist/${file}`,
  });
  db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');
  db.run(SCHEMA_SQL);
});

afterEach(() => {
  db.close();
});

function tableInfo(table: string): { name: string }[] {
  const rows = db.exec(`PRAGMA table_info(${table})`);
  if (rows.length === 0) return [];
  const nameIdx = rows[0].columns.indexOf('name');
  return rows[0].values.map((v) => ({ name: String(v[nameIdx]) }));
}

describe('schema structure', () => {
  it('creates all core tables with expected columns', () => {
    expect(tableInfo('accounts').map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'code', 'name', 'type', 'parent_id', 'is_system']),
    );
    expect(tableInfo('journal_entries').map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'voucher_type', 'voucher_number', 'date']),
    );
    expect(tableInfo('journal_lines').map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'journal_entry_id', 'account_id', 'side', 'amount_minor']),
    );
    expect(tableInfo('transactions').map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'raw_text', 'input_method', 'status']),
    );
    expect(tableInfo('item_mappings').map((c) => c.name)).toEqual(
      expect.arrayContaining(['id', 'item_name_normalized', 'account_id']),
    );
    expect(tableInfo('settings').map((c) => c.name)).toEqual(
      expect.arrayContaining(['key', 'value']),
    );
  });

  it('has foreign keys enabled', () => {
    const result = db.exec('PRAGMA foreign_keys');
    expect(result[0].values[0][0]).toBe(1);
  });

  it('stores money as integers, not floats', () => {
    db.run(`INSERT INTO accounts (code, name, type) VALUES ('1000', 'Cash', 'asset')`);
    db.run(`INSERT INTO accounts (code, name, type) VALUES ('2000', 'Sales', 'income')`);
    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('sale', 'SV-2', '2026-02-02')`,
    );
    db.run(
      `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor) VALUES (1, 1, 'debit', 99999)`,
    );
    const result = db.exec('SELECT amount_minor FROM journal_lines');
    const value = result[0].values[0][0];
    expect(Number.isInteger(value)).toBe(true);
    expect(value).toBe(99999);
  });
});

describe('constraint enforcement', () => {
  it('rejects a negative journal-line amount', () => {
    db.run(`INSERT INTO accounts (code, name, type) VALUES ('1000', 'Cash', 'asset')`);
    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('journal', 'JV-2', '2026-02-03')`,
    );
    expect(() =>
      db.run(
        `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor) VALUES (1, 1, 'debit', -100)`,
      ),
    ).toThrow();
  });

  it('rejects a zero journal-line amount', () => {
    db.run(`INSERT INTO accounts (code, name, type) VALUES ('1000', 'Cash', 'asset')`);
    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('journal', 'JV-3', '2026-02-04')`,
    );
    expect(() =>
      db.run(
        `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor) VALUES (1, 1, 'debit', 0)`,
      ),
    ).toThrow();
  });

  it('rejects a journal line referencing a non-existent account (FK violation)', () => {
    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('journal', 'JV-4', '2026-02-05')`,
    );
    expect(() =>
      db.run(
        `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor) VALUES (1, 999, 'debit', 100)`,
      ),
    ).toThrow();
  });

  it('rejects an invalid account type', () => {
    expect(() =>
      db.run(`INSERT INTO accounts (code, name, type) VALUES ('9000', 'Bogus', 'not-a-type')`),
    ).toThrow();
  });

  it('rejects an invalid journal-line side', () => {
    db.run(`INSERT INTO accounts (code, name, type) VALUES ('1000', 'Cash', 'asset')`);
    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('journal', 'JV-5', '2026-02-06')`,
    );
    expect(() =>
      db.run(
        `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor) VALUES (1, 1, 'sideways', 100)`,
      ),
    ).toThrow();
  });

  it('rejects a duplicate voucher_number', () => {
    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('journal', 'JV-6', '2026-02-07')`,
    );
    expect(() =>
      db.run(
        `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('journal', 'JV-6', '2026-02-08')`,
      ),
    ).toThrow();
  });
});
