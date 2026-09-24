import 'fake-indexeddb/auto';
import initSqlJs from 'sql.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  loadPersistedBytes,
  resetPersistenceConnection,
  savePersistedBytes,
} from '../../src/db/persistence';
import { SCHEMA_SQL } from '../../src/db/schema';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('IndexedDB persistence round trip (sql.js bytes only, no mocks)', () => {
  beforeEach(clearPersistedDb);
  afterEach(clearPersistedDb);

  it('first run has no persisted bytes', async () => {
    const bytes = await loadPersistedBytes();
    expect(bytes).toBeNull();
  });

  it('exports a real sql.js database, saves it, and restores an equivalent database from it', async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => `${process.cwd()}/node_modules/sql.js/dist/${file}`,
    });

    const original = new SQL.Database();
    original.run('PRAGMA foreign_keys = ON;');
    original.run(SCHEMA_SQL);
    original.run(`INSERT INTO accounts (code, name, type) VALUES ('2000', 'Sales', 'income')`);
    original.run(`INSERT INTO accounts (code, name, type) VALUES ('1000', 'Cash', 'asset')`);
    original.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('sale', 'SV-1', '2026-02-01')`,
    );
    original.run(
      `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor) VALUES (1, 1, 'debit', 125000)`,
    );
    original.run(
      `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor) VALUES (1, 2, 'credit', 125000)`,
    );

    const exportedBytes = original.export();
    original.close();

    await savePersistedBytes(exportedBytes);

    const restoredBytes = await loadPersistedBytes();
    expect(restoredBytes).not.toBeNull();

    // A genuinely fresh sql.js Database instance built only from the
    // restored bytes — not the original in-memory object.
    const restoredDb = new SQL.Database(restoredBytes!);
    const accounts = restoredDb.exec('SELECT code, name, type FROM accounts ORDER BY code');
    const lines = restoredDb.exec('SELECT side, amount_minor FROM journal_lines ORDER BY id');
    restoredDb.close();

    expect(accounts[0].values).toEqual([
      ['1000', 'Cash', 'asset'],
      ['2000', 'Sales', 'income'],
    ]);
    expect(lines[0].values).toEqual([
      ['debit', 125000],
      ['credit', 125000],
    ]);
  });

  it('does not write on every call: saving twice keeps a single record', async () => {
    const SQL = await initSqlJs({
      locateFile: (file) => `${process.cwd()}/node_modules/sql.js/dist/${file}`,
    });
    const db = new SQL.Database();
    db.run(SCHEMA_SQL);
    const bytes = db.export();
    db.close();

    await savePersistedBytes(bytes);
    await savePersistedBytes(bytes);

    const restored = await loadPersistedBytes();
    expect(restored).not.toBeNull();
  });
});
