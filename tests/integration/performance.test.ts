/**
 * Milestone 10: real timing measurements taken with `performance.now()`
 * inside this Node/Vitest sandbox. These are NOT real-browser or
 * real-mobile-device numbers — see docs/review-1-evidence.md, section G,
 * for that caveat. Assertions here are loose sanity bounds only (catch a
 * severe regression), never a claimed guarantee; the actual measured
 * numbers are printed for the audit report and are not hard-coded.
 */
import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import { createAccount } from '../../src/features/accounting/accounts';
import { postSale } from '../../src/features/accounting';
import { getTrialBalance } from '../../src/features/reports';
import { exportDatabase } from '../../src/features/backup/export';
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

describe('Milestone 10: performance measurements (Node/Vitest sandbox, not real browser/device)', () => {
  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await clearKeyStore();
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await clearKeyStore();
  });

  it('measures DB init, posting, report query, and backup timings on a moderate fixture', async () => {
    const t0 = performance.now();
    await initializeDatabase();
    const dbInitMs = performance.now() - t0;

    const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const sales = createAccount({ code: '4000', name: 'Sales', type: 'income' });

    const postStart = performance.now();
    for (let i = 0; i < 100; i++) {
      await postSale({
        date: `2026-04-${String((i % 28) + 1).padStart(2, '0')}`,
        amountMinor: 10000 + i,
        salesAccountId: sales.id,
        cashOrDebtorAccountId: cash.id,
        narration: `Sale #${i}`,
        voucherNumber: `PERF-${i}`,
      });
    }
    const postingMsFor100 = performance.now() - postStart;

    const reportStart = performance.now();
    const tb = getTrialBalance('2026-01-01', '2026-12-31');
    const reportMs = performance.now() - reportStart;
    expect(tb.totalDebitsMinor).toBe(tb.totalCreditsMinor);

    const exportStart = performance.now();
    const bytes = await exportDatabase();
    const exportMs = performance.now() - exportStart;

    const signStart = performance.now();
    const signed = await createSignedBackup(bytes);
    const signMs = performance.now() - signStart;

    const verifyStart = performance.now();
    const verification = verifySignedBackup(signed.envelopeBytes);
    const verifyMs = performance.now() - verifyStart;
    expect(verification.status).toBe('VALID');

    console.log(
      '[M10 perf, Node/Vitest sandbox, not real browser/device]',
      JSON.stringify({
        dbInitMs: Number(dbInitMs.toFixed(2)),
        postingMsFor100Entries: Number(postingMsFor100.toFixed(2)),
        avgPostingMsPerEntry: Number((postingMsFor100 / 100).toFixed(3)),
        trialBalanceReportMs: Number(reportMs.toFixed(2)),
        unsignedExportMs: Number(exportMs.toFixed(2)),
        signedBackupSignMs: Number(signMs.toFixed(2)),
        signedBackupVerifyMs: Number(verifyMs.toFixed(2)),
      }),
    );

    // Loose sanity bounds only (regression guard), not a performance claim.
    expect(dbInitMs).toBeLessThan(5000);
    expect(postingMsFor100).toBeLessThan(10000);
    expect(reportMs).toBeLessThan(2000);
    expect(exportMs).toBeLessThan(2000);
    expect(signMs).toBeLessThan(2000);
    expect(verifyMs).toBeLessThan(2000);
  });
});
