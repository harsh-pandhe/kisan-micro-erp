import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import { createAccount } from '../../src/features/accounting/accounts';
import { getAccountBalance, getJournalEntry } from '../../src/features/accounting/journal';
import { postJournalEntry } from '../../src/features/accounting/posting';
import type { Account } from '../../src/features/accounting/types';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('getAccountBalance', () => {
  let cash: Account;
  let sales: Account;
  let capital: Account;
  let purchase: Account;

  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
    cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    sales = createAccount({ code: '4000', name: 'Sales', type: 'income' });
    capital = createAccount({ code: '3000', name: 'Capital', type: 'equity' });
    purchase = createAccount({ code: '5000', name: 'Purchases', type: 'expense' });
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('returns 0 for an account with no postings', () => {
    expect(getAccountBalance(cash.id)).toBe(0);
  });

  it('is debit-normal for asset accounts (Cash increases with debits)', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-01',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 100000 },
        { accountId: capital.id, side: 'credit', amountMinor: 100000 },
      ],
    });
    expect(getAccountBalance(cash.id)).toBe(100000);
    // Capital is equity: credit-normal, so it also reads positive.
    expect(getAccountBalance(capital.id)).toBe(100000);
  });

  it('is credit-normal for income accounts (Sales increases with credits)', async () => {
    await postJournalEntry({
      voucherType: 'sale',
      date: '2026-01-02',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 500 },
        { accountId: sales.id, side: 'credit', amountMinor: 500 },
      ],
    });
    expect(getAccountBalance(sales.id)).toBe(500);
  });

  it('is debit-normal for expense accounts', async () => {
    await postJournalEntry({
      voucherType: 'purchase',
      date: '2026-01-03',
      lines: [
        { accountId: purchase.id, side: 'debit', amountMinor: 300 },
        { accountId: cash.id, side: 'credit', amountMinor: 300 },
      ],
    });
    expect(getAccountBalance(purchase.id)).toBe(300);
    expect(getAccountBalance(cash.id)).toBe(-300);
  });

  it('is deterministic and reproducible from the same journal lines', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-04',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 200 },
        { accountId: capital.id, side: 'credit', amountMinor: 200 },
      ],
    });
    const first = getAccountBalance(cash.id);
    const second = getAccountBalance(cash.id);
    expect(first).toBe(second);
  });

  it('every successful posting satisfies sum(debits) === sum(credits)', async () => {
    const posted = await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-05',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 70 },
        { accountId: capital.id, side: 'credit', amountMinor: 40 },
        { accountId: sales.id, side: 'credit', amountMinor: 30 },
      ],
    });
    const reread = getJournalEntry(posted.id)!;
    const debitTotal = reread.lines
      .filter((l) => l.side === 'debit')
      .reduce((s, l) => s + l.amountMinor, 0);
    const creditTotal = reread.lines
      .filter((l) => l.side === 'credit')
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debitTotal).toBe(creditTotal);
  });
});

describe('accounting persistence integration', () => {
  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('a posted journal entry survives a full close/restore cycle via IndexedDB', async () => {
    await initializeDatabase();
    const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const capital = createAccount({ code: '3000', name: 'Capital', type: 'equity' });

    const posted = await postJournalEntry({
      voucherType: 'journal',
      voucherNumber: 'JV-PERSIST-1',
      date: '2026-01-06',
      narration: 'opening capital',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 900000 },
        { accountId: capital.id, side: 'credit', amountMinor: 900000 },
      ],
    });

    // Simulate a fresh app launch: drop the in-memory instance entirely and
    // restore a brand new one purely from IndexedDB bytes.
    closeDatabase();
    await initializeDatabase();

    const reread = getJournalEntry(posted.id);
    expect(reread).not.toBeNull();
    expect(reread!.voucherNumber).toBe('JV-PERSIST-1');
    expect(reread!.lines).toHaveLength(2);
    expect(getAccountBalance(cash.id)).toBe(900000);
    expect(getAccountBalance(capital.id)).toBe(900000);
  });
});
