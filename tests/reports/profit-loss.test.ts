import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { postJournalEntry } from '../../src/features/accounting/posting';
import { getProfitAndLoss } from '../../src/features/reports/profit-loss';
import { freshDb, clearPersistedDb, seedAccounts, type SeededAccounts } from './helpers';

describe('getProfitAndLoss', () => {
  let accounts: SeededAccounts;

  beforeEach(async () => {
    await freshDb();
    accounts = seedAccounts();
  });
  afterEach(async () => {
    await clearPersistedDb();
  });

  it('returns clean zero values for an empty database', () => {
    const report = getProfitAndLoss('2026-01-01', '2026-01-31');
    expect(report.income).toEqual([]);
    expect(report.expenses).toEqual([]);
    expect(report.totalIncomeMinor).toBe(0);
    expect(report.totalExpensesMinor).toBe(0);
    expect(report.netProfitMinor).toBe(0);
    expect(Number.isNaN(report.netProfitMinor)).toBe(false);
  });

  it('computes income and expense totals from journal lines, not the transactions table', async () => {
    await postJournalEntry({
      voucherType: 'sale',
      date: '2026-01-05',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 20000 },
        { accountId: accounts.sales.id, side: 'credit', amountMinor: 20000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'purchase',
      date: '2026-01-06',
      lines: [
        { accountId: accounts.purchases.id, side: 'debit', amountMinor: 5000 },
        { accountId: accounts.cash.id, side: 'credit', amountMinor: 5000 },
      ],
    });

    const report = getProfitAndLoss('2026-01-01', '2026-01-31');
    expect(report.totalIncomeMinor).toBe(20000);
    expect(report.totalExpensesMinor).toBe(5000);
    expect(report.netProfitMinor).toBe(15000);
    expect(report.income[0].accountId).toBe(accounts.sales.id);
    expect(report.expenses[0].accountId).toBe(accounts.purchases.id);
  });

  it('excludes asset/liability/equity accounts from income and expenses', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-01',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 100000 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 100000 },
      ],
    });

    const report = getProfitAndLoss('2026-01-01', '2026-01-31');
    expect(report.income).toEqual([]);
    expect(report.expenses).toEqual([]);
    expect(report.netProfitMinor).toBe(0);
  });

  it('reports a loss (negative net) when expenses exceed income', async () => {
    await postJournalEntry({
      voucherType: 'sale',
      date: '2026-01-05',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 1000 },
        { accountId: accounts.sales.id, side: 'credit', amountMinor: 1000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'purchase',
      date: '2026-01-06',
      lines: [
        { accountId: accounts.purchases.id, side: 'debit', amountMinor: 9000 },
        { accountId: accounts.cash.id, side: 'credit', amountMinor: 9000 },
      ],
    });

    const report = getProfitAndLoss('2026-01-01', '2026-01-31');
    expect(report.netProfitMinor).toBe(-8000);
  });

  it('respects inclusive date boundaries', async () => {
    await postJournalEntry({
      voucherType: 'sale',
      date: '2026-02-01',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 100 },
        { accountId: accounts.sales.id, side: 'credit', amountMinor: 100 },
      ],
    });
    await postJournalEntry({
      voucherType: 'sale',
      date: '2026-02-28',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 200 },
        { accountId: accounts.sales.id, side: 'credit', amountMinor: 200 },
      ],
    });
    await postJournalEntry({
      voucherType: 'sale',
      date: '2026-03-01',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 400 },
        { accountId: accounts.sales.id, side: 'credit', amountMinor: 400 },
      ],
    });

    const report = getProfitAndLoss('2026-02-01', '2026-02-28');
    expect(report.totalIncomeMinor).toBe(300);
  });
});
