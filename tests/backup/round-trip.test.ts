import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initializeDatabase } from '../../src/db/database';
import { createAccount, getAllAccounts } from '../../src/features/accounting';
import { classify, learnMapping, listMappings } from '../../src/features/classification';
import { getTrialBalance } from '../../src/features/reports';
import { listTransactionHistory, recordTransaction } from '../../src/features/transactions';
import { exportDatabase } from '../../src/features/backup/export';
import { restoreDatabase } from '../../src/features/backup/import';
import { resetDb } from './helpers';

describe('round trip: build DB A, export, restore over a different DB B', () => {
  beforeEach(async () => {
    await resetDb();
    await initializeDatabase();
  });
  afterEach(resetDb);

  it('replaces DB B entirely with DB A, and A survives a fresh reload from IndexedDB', async () => {
    // ---- Build DB A via the real M3/M5/M6 APIs. ----
    const cashA = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const salesA = createAccount({ code: '4000', name: 'Sales', type: 'income' });
    await learnMapping('wheat', salesA.id);
    await recordTransaction({
      rawText: 'Sold 1000 cash wheat',
      inputMethod: 'text',
      type: 'sale',
      amountMinor: 100000,
      date: '2026-01-10',
      classifiedAccountId: salesA.id,
      counterAccountId: cashA.id,
      narration: 'wheat',
    });
    getDatabase().run(`INSERT INTO settings (key, value) VALUES ('farm_name', 'Farm A')`);
    await import('../../src/db/database').then((m) => m.persistDatabase());

    const backupBytes = await exportDatabase();

    // ---- Build a different DB B, discarding A. ----
    closeDatabase();
    await resetDb();
    await initializeDatabase();
    const cashB = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const feedB = createAccount({ code: '5000', name: 'Feed', type: 'expense' });
    await recordTransaction({
      rawText: 'Paid 200 cash feed',
      inputMethod: 'text',
      type: 'purchase',
      amountMinor: 20000,
      date: '2026-02-01',
      classifiedAccountId: feedB.id,
      counterAccountId: cashB.id,
      narration: 'feed',
    });
    expect(getAllAccounts().map((a) => a.name)).toEqual(['Cash', 'Feed']);

    // ---- Restore A over B. ----
    const summary = await restoreDatabase(backupBytes);
    expect(summary.accounts).toBe(2);
    expect(summary.transactions).toBe(1);
    expect(summary.itemMappings).toBe(1);

    // Every category of A's data present; B's data gone.
    const accountsAfter = getAllAccounts();
    expect(accountsAfter.map((a) => a.name).sort()).toEqual(['Cash', 'Sales']);

    const history = listTransactionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].narration).toBe('wheat');

    const mappings = listMappings();
    expect(mappings).toHaveLength(1);
    expect(mappings[0].itemNameNormalized).toBe('wheat');

    const settingsRow = getDatabase().query<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'farm_name'",
    );
    expect(settingsRow[0].value).toBe('Farm A');

    // Cross-feature: reports naturally reflect the restored data via
    // getDatabase(), no special-casing needed.
    const trialBalance = getTrialBalance('2026-01-01', '2026-01-31');
    expect(trialBalance.isBalanced).toBe(true);
    expect(trialBalance.rows.some((r) => r.accountName === 'Sales')).toBe(true);

    // Classification also sees the restored mapping.
    const classified = classify({
      type: 'sale',
      amount: { minorUnits: 5000, currency: 'INR' },
      party: undefined,
      description: 'wheat',
      date: undefined,
      paymentMode: undefined,
      rawText: 'sold wheat',
      normalizedText: 'sold wheat',
    });
    expect(classified.status).toBe('matched');

    // ---- Persist, drop in-memory instance, reload fresh from IndexedDB. ----
    const { persistDatabase } = await import('../../src/db/database');
    await persistDatabase();
    closeDatabase();
    const reloaded = await initializeDatabase();
    const reloadedAccounts = reloaded.query<{ name: string }>('SELECT name FROM accounts');
    expect(reloadedAccounts.map((a) => a.name).sort()).toEqual(['Cash', 'Sales']);
  });

  it('handles an empty-database export/restore cleanly', async () => {
    const emptyBytes = await exportDatabase();
    expect(getAllAccounts()).toHaveLength(0);

    const summary = await restoreDatabase(emptyBytes);
    expect(summary.accounts).toBe(0);
    expect(summary.journalEntries).toBe(0);
    expect(summary.transactions).toBe(0);
    expect(getAllAccounts()).toHaveLength(0);
  });
});
