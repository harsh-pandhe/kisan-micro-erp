/**
 * Milestone 10: deterministic moderately-larger fixture (120 transactions
 * across 4 accounts) proving SQLite/reports/backup/restore remain correct
 * and usable at a realistic small-business scale, not just single-row unit
 * tests. Deterministic (no randomness) so the run is reproducible.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import { createAccount } from '../../src/features/accounting/accounts';
import { postPurchase, postSale } from '../../src/features/accounting';
import { getBalanceSheet, getProfitAndLoss, getTrialBalance } from '../../src/features/reports';
import { exportDatabase } from '../../src/features/backup/export';
import { restoreDatabase, validateBackupAndSummarize } from '../../src/features/backup/import';
import { createSignedBackup } from '../../src/features/crypto/sign';
import { verifySignedBackup } from '../../src/features/crypto/verify';
import { resetKeyStoreConnection } from '../../src/features/crypto';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

async function clearKeyStore(): Promise<void> {
  resetKeyStoreConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp-crypto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

const TRANSACTION_COUNT = 120;

describe('Milestone 10: deterministic large fixture (120 transactions)', () => {
  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await clearKeyStore();
    await initializeDatabase();
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await clearKeyStore();
  });

  it('stays correct and usable at 120 postings: reports, backup, signed backup, restore', async () => {
    const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const sales = createAccount({ code: '4000', name: 'Sales', type: 'income' });
    const fertilizer = createAccount({ code: '5000', name: 'Fertilizer Expense', type: 'expense' });
    const seed = createAccount({ code: '5100', name: 'Seed Expense', type: 'expense' });

    let expectedIncomeMinor = 0;
    let expectedExpenseMinor = 0;

    for (let i = 0; i < TRANSACTION_COUNT; i++) {
      const day = String((i % 28) + 1).padStart(2, '0');
      const date = `2026-03-${day}`;
      const amountMinor = 10000 + (i % 17) * 500; // deterministic varying amount

      if (i % 2 === 0) {
        await postSale({
          date,
          amountMinor,
          salesAccountId: sales.id,
          cashOrDebtorAccountId: cash.id,
          narration: `Sale #${i}`,
          voucherNumber: `SALE-${i}`,
        });
        expectedIncomeMinor += amountMinor;
      } else {
        const expenseAccountId = i % 3 === 0 ? seed.id : fertilizer.id;
        await postPurchase({
          date,
          amountMinor,
          expenseOrItemAccountId: expenseAccountId,
          cashOrCreditorAccountId: cash.id,
          narration: `Purchase #${i}`,
          voucherNumber: `PURCH-${i}`,
        });
        expectedExpenseMinor += amountMinor;
      }
    }

    const tb = getTrialBalance('2026-01-01', '2026-12-31');
    expect(tb.totalDebitsMinor).toBe(tb.totalCreditsMinor);
    expect(tb.rows.length).toBeGreaterThan(0);

    const pl = getProfitAndLoss('2026-01-01', '2026-12-31');
    expect(pl.totalIncomeMinor).toBe(expectedIncomeMinor);
    expect(pl.totalExpensesMinor).toBe(expectedExpenseMinor);
    expect(pl.netProfitMinor).toBe(expectedIncomeMinor - expectedExpenseMinor);

    const bs = getBalanceSheet('2026-12-31');
    expect(bs.totalAssetsMinor).toBe(bs.totalLiabilitiesMinor + bs.totalEquityMinor);

    // Unsigned backup round-trip stays valid at this scale.
    const bytes = await exportDatabase();
    const summary = await validateBackupAndSummarize(bytes);
    expect(summary.journalEntries).toBe(TRANSACTION_COUNT);

    // Signed backup round-trip stays valid at this scale.
    const signed = await createSignedBackup(bytes);
    expect(verifySignedBackup(signed.envelopeBytes).status).toBe('VALID');

    // Restore and confirm reports are unchanged.
    await restoreDatabase(bytes);
    const tbAfter = getTrialBalance('2026-01-01', '2026-12-31');
    expect(tbAfter).toEqual(tb);
  });
});
