import 'fake-indexeddb/auto';
import initSqlJs from 'sql.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initializeDatabase } from '../../src/db/database';
import { loadPersistedBytes, resetPersistenceConnection } from '../../src/db/persistence';
import { SCHEMA_SQL } from '../../src/db/schema';
import { createAccount } from '../../src/features/accounting/accounts';
import type { Account } from '../../src/features/accounting/types';
import { classify } from '../../src/features/classification/classify';
import { learnMapping, relearnMapping } from '../../src/features/classification/learning';
import {
  MappingAccountNotFoundError,
  MappingValidationError,
} from '../../src/features/classification/types';
import type { ParsedTransaction } from '../../src/parser/types';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function makeTransaction(description: string): ParsedTransaction {
  return {
    type: 'purchase',
    amount: { minorUnits: 1000, currency: 'INR' },
    party: undefined,
    description,
    date: '2026-01-01',
    paymentMode: 'cash',
    rawText: description,
    normalizedText: description,
  };
}

describe('learning', () => {
  let fertilizerExpense: Account;
  let dieselExpense: Account;

  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
    fertilizerExpense = createAccount({
      code: '5000',
      name: 'Fertilizer Expense',
      type: 'expense',
    });
    dieselExpense = createAccount({ code: '5001', name: 'Diesel Expense', type: 'expense' });
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('learning flow: unknown item becomes MATCHED after learnMapping', () => {
    const before = classify(makeTransaction('kisan gold fertilizer'));
    expect(before.status).toBe('unknown');

    // learnMapping stores the exact normalized item text the user confirmed.
    return learnMapping('kisan gold fertilizer', fertilizerExpense.id).then(() => {
      const after = classify(makeTransaction('kisan gold fertilizer'));
      expect(after.status).toBe('matched');
      if (after.status === 'matched') {
        expect(after.accountId).toBe(fertilizerExpense.id);
        expect(after.matchSource).toBe('exact_mapping');
      }
    });
  });

  it('invalid account: learnMapping rejects a nonexistent account and creates no mapping', async () => {
    await expect(learnMapping('urea', 999999)).rejects.toThrow(MappingAccountNotFoundError);
    const result = classify(makeTransaction('urea'));
    expect(result.status).toBe('unknown');
  });

  it('rejects an empty source key', async () => {
    await expect(learnMapping('   ', fertilizerExpense.id)).rejects.toThrow(MappingValidationError);
  });

  it('duplicate mapping: learnMapping on an already-learned key is rejected (explicit, not silently idempotent)', async () => {
    await learnMapping('diesel', dieselExpense.id);
    await expect(learnMapping('diesel', fertilizerExpense.id)).rejects.toThrow(
      MappingValidationError,
    );
    // The original mapping is untouched.
    const result = classify(makeTransaction('diesel'));
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe(dieselExpense.id);
    }
  });

  it('mapping update: relearnMapping changes item -> accountB after item -> accountA', async () => {
    await learnMapping('diesel', fertilizerExpense.id);
    await relearnMapping('diesel', dieselExpense.id);
    const result = classify(makeTransaction('diesel'));
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe(dieselExpense.id);
    }
  });

  it('learning never posts a journal entry as a side effect', async () => {
    const before = getDatabase().query('SELECT * FROM journal_entries').length;
    await learnMapping('pesticide spray', fertilizerExpense.id);
    expect(getDatabase().query('SELECT * FROM journal_entries').length).toBe(before);
  });

  it('persistence: a learned mapping survives a fresh DB instance restored from IndexedDB', async () => {
    await learnMapping('urea fertilizer', fertilizerExpense.id);

    // Simulate a fresh session: close this connection and read back only
    // the bytes IndexedDB now holds, via a brand-new sql.js Database.
    const persistedBytes = await loadPersistedBytes();
    expect(persistedBytes).not.toBeNull();

    const SQL = await initSqlJs({
      locateFile: (file) => `${process.cwd()}/node_modules/sql.js/dist/${file}`,
    });
    const restored = new SQL.Database(persistedBytes!);
    restored.run(SCHEMA_SQL);
    const rows = restored.exec(
      "SELECT item_name_normalized, account_id FROM item_mappings WHERE item_name_normalized = 'urea fertilizer'",
    );
    restored.close();

    expect(rows[0]?.values).toEqual([['urea fertilizer', fertilizerExpense.id]]);

    // And re-initializing the real app database (as the app does on
    // startup) sees the mapping too, so classification matches again.
    closeDatabase();
    await initializeDatabase();
    const reclassified = classify(makeTransaction('urea fertilizer'));
    expect(reclassified.status).toBe('matched');
    if (reclassified.status === 'matched') {
      expect(reclassified.accountId).toBe(fertilizerExpense.id);
    }
  });
});
