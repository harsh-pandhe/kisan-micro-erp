import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { postJournalEntry } from '../../src/features/accounting/posting';
import { getBalanceSheet } from '../../src/features/reports/balance-sheet';
import { freshDb, clearPersistedDb, seedAccounts, type SeededAccounts } from './helpers';

describe('getBalanceSheet', () => {
  let accounts: SeededAccounts;

  beforeEach(async () => {
    await freshDb();
    accounts = seedAccounts();
  });
  afterEach(async () => {
    await clearPersistedDb();
  });

  it('returns clean zero values for an empty database and is still balanced', () => {
    const report = getBalanceSheet('2026-01-31');
    expect(report.assets).toEqual([]);
    expect(report.liabilities).toEqual([]);
    expect(report.equity).toEqual([]);
    expect(report.totalAssetsMinor).toBe(0);
    expect(report.totalLiabilitiesMinor).toBe(0);
    expect(report.totalEquityMinor).toBe(0);
    expect(report.currentPeriodProfitMinor).toBe(0);
    expect(report.isBalanced).toBe(true);
  });

  it('satisfies Assets = Liabilities + Equity for a simple capital introduction', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-01',
      narration: 'Capital introduced',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 500000 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 500000 },
      ],
    });

    const report = getBalanceSheet('2026-01-31');
    expect(report.totalAssetsMinor).toBe(500000);
    expect(report.totalEquityMinor).toBe(500000);
    expect(report.totalLiabilitiesMinor).toBe(0);
    expect(report.isBalanced).toBe(true);
  });

  it('folds current-period profit/loss into equity', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-01',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 100000 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 100000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'sale',
      date: '2026-01-10',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 20000 },
        { accountId: accounts.sales.id, side: 'credit', amountMinor: 20000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'purchase',
      date: '2026-01-12',
      lines: [
        { accountId: accounts.purchases.id, side: 'debit', amountMinor: 5000 },
        { accountId: accounts.cash.id, side: 'credit', amountMinor: 5000 },
      ],
    });

    const report = getBalanceSheet('2026-01-31');
    // Cash: 100000 + 20000 - 5000 = 115000; equals total assets.
    expect(report.totalAssetsMinor).toBe(115000);
    expect(report.currentPeriodProfitMinor).toBe(15000); // 20000 income - 5000 expense
    expect(report.totalEquityMinor).toBe(100000 + 15000);
    expect(report.totalAssetsMinor).toBe(report.totalLiabilitiesMinor + report.totalEquityMinor);
    expect(report.isBalanced).toBe(true);
  });

  it('excludes entries dated after the as-of date', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-01',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 1000 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 1000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-02-01',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 2000 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 2000 },
      ],
    });

    const report = getBalanceSheet('2026-01-15');
    expect(report.totalAssetsMinor).toBe(1000);
    expect(report.totalEquityMinor).toBe(1000);
  });

  it('includes an entry dated exactly on the as-of date', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-15',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 7500 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 7500 },
      ],
    });

    const report = getBalanceSheet('2026-01-15');
    expect(report.totalAssetsMinor).toBe(7500);
  });

  it('reflects a liability from a credit purchase', async () => {
    await postJournalEntry({
      voucherType: 'purchase',
      date: '2026-01-05',
      lines: [
        { accountId: accounts.purchases.id, side: 'debit', amountMinor: 3000 },
        { accountId: accounts.creditor.id, side: 'credit', amountMinor: 3000 },
      ],
    });

    const report = getBalanceSheet('2026-01-31');
    expect(report.totalLiabilitiesMinor).toBe(3000);
    // Expense reduces current-period profit, which is folded into equity.
    expect(report.currentPeriodProfitMinor).toBe(-3000);
    expect(report.totalAssetsMinor).toBe(report.totalLiabilitiesMinor + report.totalEquityMinor);
    expect(report.isBalanced).toBe(true);
  });
});
