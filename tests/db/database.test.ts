import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  closeDatabase,
  getDatabase,
  initializeDatabase,
  persistDatabase,
} from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('database lifecycle', () => {
  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('initializes exactly once under concurrent calls', async () => {
    const [a, b, c] = await Promise.all([
      initializeDatabase(),
      initializeDatabase(),
      initializeDatabase(),
    ]);
    expect(a).toBe(b);
    expect(b).toBe(c);
    expect(a.raw).toBe(getDatabase().raw);
  });

  it('applies the schema on first run (fresh in-memory DB)', async () => {
    const db = await initializeDatabase();
    const tables = db.query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
    );
    const names = tables.map((t) => t.name);
    expect(names).toEqual(
      expect.arrayContaining([
        'accounts',
        'journal_entries',
        'journal_lines',
        'transactions',
        'item_mappings',
        'settings',
      ]),
    );
  });

  it('throws from getDatabase() before initialization', () => {
    expect(() => getDatabase()).toThrow();
  });
});

describe('full persistence round trip through the public API', () => {
  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('persists a fresh DB to IndexedDB and restores it into a new instance with data intact', async () => {
    const db = await initializeDatabase();
    db.run(`INSERT INTO accounts (code, name, type) VALUES ('1000', 'Cash', 'asset')`);
    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date, narration)
       VALUES ('journal', 'JV-1', '2026-01-01', 'opening balance')`,
    );
    db.run(
      `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor)
       VALUES (1, 1, 'debit', 500000)`,
    );
    await persistDatabase();

    // Simulate a fresh app launch: drop the in-memory instance entirely.
    closeDatabase();

    const restored = await initializeDatabase();
    const accounts = restored.query<{ code: string; name: string }>(
      'SELECT code, name FROM accounts',
    );
    const lines = restored.query<{ amount_minor: number; side: string }>(
      'SELECT amount_minor, side FROM journal_lines',
    );

    expect(accounts).toEqual([{ code: '1000', name: 'Cash' }]);
    expect(lines).toEqual([{ amount_minor: 500000, side: 'debit' }]);
  });
});
