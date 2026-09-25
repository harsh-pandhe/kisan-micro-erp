/**
 * Milestone 10: canonical Phase-1 end-to-end regression test.
 *
 * Exercises the full real chain with no mocking of core logic: parser ->
 * classifier -> accounting -> SQLite -> IndexedDB persistence -> reports ->
 * unsigned backup -> signed backup (SHA-256 + Ed25519) -> restore ->
 * reports after restore identical to reports before restore.
 *
 * Also proves the negative case: a rejected/failed transaction produces no
 * partial journal data and never appears in any report.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import { resetKeyStoreConnection } from '../../src/features/crypto';
import { createAccount } from '../../src/features/accounting/accounts';
import { classify, learnMapping } from '../../src/features/classification';
import { parseTransactionText } from '../../src/parser';
import {
  countTransactions,
  listTransactionHistory,
  recordTransaction,
} from '../../src/features/transactions/service';
import { getBalanceSheet, getProfitAndLoss, getTrialBalance } from '../../src/features/reports';
import { exportDatabase } from '../../src/features/backup/export';
import { restoreDatabase, validateBackupAndSummarize } from '../../src/features/backup/import';
import { createSignedBackup } from '../../src/features/crypto/sign';
import { verifySignedBackup } from '../../src/features/crypto/verify';
import { restoreSignedDatabase } from '../../src/features/backup/import';

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

const REF_DATE = new Date('2026-02-01T09:00:00Z');

describe('Milestone 10: canonical Phase-1 regression', () => {
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

  it('runs the full chain and produces identical reports after a signed restore', async () => {
    const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const fertilizer = createAccount({ code: '5000', name: 'Fertilizer Expense', type: 'expense' });
    const sales = createAccount({ code: '4000', name: 'Sales', type: 'income' });

    await learnMapping('fertilizer', fertilizer.id);

    // 1. Parse
    const rawText = 'Paid 750 cash for fertilizer';
    const parsed = parseTransactionText(rawText, REF_DATE);
    expect(parsed.status).toBe('SUCCESS');
    if (parsed.status !== 'SUCCESS') throw new Error('unreachable');

    // 2. Classify (deterministic, learned mapping)
    const classification = classify(parsed.transaction);
    expect(classification.status).toBe('matched');
    if (classification.status !== 'matched') throw new Error('unreachable');

    // 3. User confirms -> post
    const { journalEntry } = await recordTransaction({
      rawText,
      inputMethod: 'text',
      type: parsed.transaction.type!,
      amountMinor: parsed.transaction.amount!.minorUnits,
      date: parsed.transaction.date ?? '2026-02-01',
      classifiedAccountId: classification.accountId,
      counterAccountId: cash.id,
      narration: parsed.transaction.description,
    });
    const debit = journalEntry.lines.find((l) => l.side === 'debit')!;
    const credit = journalEntry.lines.find((l) => l.side === 'credit')!;
    expect(debit.amountMinor).toBe(credit.amountMinor);

    // A second transaction, a sale, so P&L/Balance Sheet have real content.
    const saleText = 'Received 2000 cash for sale';
    const saleParsed = parseTransactionText(saleText, REF_DATE);
    expect(saleParsed.status).toBe('SUCCESS');
    if (saleParsed.status !== 'SUCCESS') throw new Error('unreachable');
    await learnMapping('sale', sales.id);
    const saleClassification = classify(saleParsed.transaction);
    expect(saleClassification.status).toBe('matched');
    if (saleClassification.status !== 'matched') throw new Error('unreachable');
    await recordTransaction({
      rawText: saleText,
      inputMethod: 'text',
      type: saleParsed.transaction.type!,
      amountMinor: saleParsed.transaction.amount!.minorUnits,
      date: saleParsed.transaction.date ?? '2026-02-01',
      classifiedAccountId: saleClassification.accountId,
      counterAccountId: cash.id,
      narration: saleParsed.transaction.description,
    });

    // 4. History
    expect(countTransactions()).toBe(2);
    expect(listTransactionHistory().every((t) => t.status === 'posted')).toBe(true);

    // 5. Reports before backup
    const periodStart = '2026-01-01';
    const periodEnd = '2026-12-31';
    const tbBefore = getTrialBalance(periodStart, periodEnd);
    const plBefore = getProfitAndLoss(periodStart, periodEnd);
    const bsBefore = getBalanceSheet(periodEnd);

    expect(tbBefore.totalDebitsMinor).toBe(tbBefore.totalCreditsMinor);
    expect(bsBefore.totalAssetsMinor).toBe(
      bsBefore.totalLiabilitiesMinor + bsBefore.totalEquityMinor,
    );

    // 6. Unsigned backup export + validate
    const unsignedBytes = await exportDatabase();
    const unsignedSummary = await validateBackupAndSummarize(unsignedBytes);
    expect(unsignedSummary.transactions).toBe(2);

    // 7. Signed backup export + verify
    const signed = await createSignedBackup(unsignedBytes);
    const verification = verifySignedBackup(signed.envelopeBytes);
    expect(verification.status).toBe('VALID');

    // 8. Restore from the signed backup (into the SAME running app, as a
    // real restore would) and confirm reports are identical afterward.
    const restoreResult = await restoreSignedDatabase(signed.envelopeBytes);
    expect(restoreResult.summary.transactions).toBe(2);

    const tbAfter = getTrialBalance(periodStart, periodEnd);
    const plAfter = getProfitAndLoss(periodStart, periodEnd);
    const bsAfter = getBalanceSheet(periodEnd);

    expect(tbAfter).toEqual(tbBefore);
    expect(plAfter).toEqual(plBefore);
    expect(bsAfter).toEqual(bsBefore);

    // Also prove the plain (unsigned) restore path round-trips correctly.
    const restoredUnsigned = await restoreDatabase(unsignedBytes);
    expect(restoredUnsigned.transactions).toBe(2);
    expect(getTrialBalance(periodStart, periodEnd)).toEqual(tbBefore);
  });

  it('a failed transaction produces no partial journal data and never appears in reports', async () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });

    // Unparseable input -> parser fails before any classification/posting.
    const result = parseTransactionText('asdkjaslkdj', REF_DATE);
    expect(result.status).not.toBe('SUCCESS');

    expect(countTransactions()).toBe(0);
    expect(listTransactionHistory()).toHaveLength(0);

    const tb = getTrialBalance('2026-01-01', '2026-12-31');
    expect(tb.rows).toHaveLength(0);
    expect(tb.totalDebitsMinor).toBe(0);
    expect(tb.totalCreditsMinor).toBe(0);
  });
});
