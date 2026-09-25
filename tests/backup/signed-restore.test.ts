import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initializeDatabase } from '../../src/db/database';
import { createAccount, getAllAccounts } from '../../src/features/accounting';
import { learnMapping } from '../../src/features/classification';
import { getBalanceSheet, getProfitAndLoss, getTrialBalance } from '../../src/features/reports';
import { recordTransaction } from '../../src/features/transactions';
import { exportSignedDatabase } from '../../src/features/backup/export';
import {
  restoreSignedDatabase,
  validateSignedBackupAndSummarize,
} from '../../src/features/backup/import';
import { resetKeyStoreConnection } from '../../src/features/crypto/keys';
import { resetDb } from './helpers';

async function clearKeyDb(): Promise<void> {
  resetKeyStoreConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp-crypto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('signed backup restore', () => {
  beforeEach(async () => {
    await resetDb();
    await clearKeyDb();
    await initializeDatabase();
  });
  afterEach(async () => {
    await resetDb();
    await clearKeyDb();
  });

  it('validates and summarizes a signed backup without restoring', async () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const result = await exportSignedDatabase();

    const summary = await validateSignedBackupAndSummarize(result.envelopeBytes);
    expect(summary.summary.accounts).toBe(1);
    expect(summary.keyFingerprint).toHaveLength(16);

    // Validation must not have touched the live DB.
    expect(getAllAccounts()).toHaveLength(1);
  });

  it('restores a signed backup over a different active database', async () => {
    // ---- Build DB A and sign it. ----
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
    const signedResult = await exportSignedDatabase();

    // ---- Build a different DB B. ----
    closeDatabase();
    await resetDb();
    await initializeDatabase();
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    createAccount({ code: '5000', name: 'Feed', type: 'expense' });
    expect(getAllAccounts()).toHaveLength(2);

    // ---- Restore signed backup A over B. ----
    const { summary } = await restoreSignedDatabase(signedResult.envelopeBytes);
    expect(summary.accounts).toBe(2);
    expect(summary.transactions).toBe(1);
    expect(getAllAccounts().map((a) => a.name)).toEqual(['Cash', 'Sales']);
  });

  it('fails with a rejected signature and leaves the active DB untouched (tampered payload)', async () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const signedResult = await exportSignedDatabase();

    closeDatabase();
    await resetDb();
    await initializeDatabase();
    createAccount({ code: '9999', name: 'Untouched', type: 'asset' });
    const beforeBytes = getDatabase().export();

    const tampered = new Uint8Array(signedResult.envelopeBytes);
    tampered[tampered.length - 1] ^= 0xff;

    await expect(restoreSignedDatabase(tampered)).rejects.toThrow();

    const afterBytes = getDatabase().export();
    expect(afterBytes).toEqual(beforeBytes);
    expect(getAllAccounts().map((a) => a.name)).toEqual(['Untouched']);
  });

  it('full round trip: financial reports are identical before and after a signed-backup restore', async () => {
    const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const sales = createAccount({ code: '4000', name: 'Sales', type: 'income' });
    const feed = createAccount({ code: '5000', name: 'Feed', type: 'expense' });
    await learnMapping('wheat', sales.id);
    await recordTransaction({
      rawText: 'Sold 1000 cash wheat',
      inputMethod: 'text',
      type: 'sale',
      amountMinor: 100000,
      date: '2026-01-10',
      classifiedAccountId: sales.id,
      counterAccountId: cash.id,
      narration: 'wheat',
    });
    await recordTransaction({
      rawText: 'Paid 200 cash feed',
      inputMethod: 'text',
      type: 'purchase',
      amountMinor: 20000,
      date: '2026-02-01',
      classifiedAccountId: feed.id,
      counterAccountId: cash.id,
      narration: 'feed',
    });

    const trialBefore = getTrialBalance('2026-01-01', '2026-12-31');
    const pnlBefore = getProfitAndLoss('2026-01-01', '2026-12-31');
    const bsBefore = getBalanceSheet('2026-12-31');

    const signedResult = await exportSignedDatabase();
    const verification = await validateSignedBackupAndSummarize(signedResult.envelopeBytes);
    expect(verification.summary.transactions).toBe(2);

    // Restore over a fresh, different database, then reload from IndexedDB
    // to simulate a real app reload.
    closeDatabase();
    await resetDb();
    await initializeDatabase();
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });

    await restoreSignedDatabase(signedResult.envelopeBytes);
    closeDatabase();
    await initializeDatabase();

    const trialAfter = getTrialBalance('2026-01-01', '2026-12-31');
    const pnlAfter = getProfitAndLoss('2026-01-01', '2026-12-31');
    const bsAfter = getBalanceSheet('2026-12-31');

    expect(trialAfter).toEqual(trialBefore);
    expect(pnlAfter).toEqual(pnlBefore);
    expect(bsAfter).toEqual(bsBefore);
  });
});
