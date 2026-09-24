import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { postJournalEntry } from '../../src/features/accounting/posting';
import { getTrialBalance } from '../../src/features/reports/trial-balance';
import { freshDb, clearPersistedDb, seedAccounts, type SeededAccounts } from './helpers';

describe('getTrialBalance', () => {
  let accounts: SeededAccounts;

  beforeEach(async () => {
    await freshDb();
    accounts = seedAccounts();
  });
  afterEach(async () => {
    await clearPersistedDb();
  });

  it('returns zero rows and a balanced empty report for an empty database', () => {
    const report = getTrialBalance('2026-01-01', '2026-01-31');
    expect(report.rows).toEqual([]);
    expect(report.totalDebitsMinor).toBe(0);
    expect(report.totalCreditsMinor).toBe(0);
    expect(report.isBalanced).toBe(true);
  });

  it('reflects one journal entry within the period', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-10',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 100000 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 100000 },
      ],
    });

    const report = getTrialBalance('2026-01-01', '2026-01-31');
    expect(report.rows).toHaveLength(2);
    const cashRow = report.rows.find((r) => r.accountId === accounts.cash.id)!;
    expect(cashRow.debitTotal).toBe(100000);
    expect(cashRow.creditTotal).toBe(0);
    expect(cashRow.closingBalanceMinor).toBe(100000);
    expect(report.totalDebitsMinor).toBe(100000);
    expect(report.totalCreditsMinor).toBe(100000);
    expect(report.isBalanced).toBe(true);
  });

  it('aggregates multiple entries across multiple account types', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-05',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 500000 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 500000 },
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

    const report = getTrialBalance('2026-01-01', '2026-01-31');
    expect(report.rows).toHaveLength(4);
    expect(report.totalDebitsMinor).toBe(report.totalCreditsMinor);
    expect(report.isBalanced).toBe(true);

    const cashRow = report.rows.find((r) => r.accountId === accounts.cash.id)!;
    expect(cashRow.closingBalanceMinor).toBe(500000 + 20000 - 5000);
  });

  describe('date filtering (inclusive boundaries)', () => {
    beforeEach(async () => {
      await postJournalEntry({
        voucherType: 'journal',
        date: '2026-02-01',
        lines: [
          { accountId: accounts.cash.id, side: 'debit', amountMinor: 111 },
          { accountId: accounts.capital.id, side: 'credit', amountMinor: 111 },
        ],
      });
      await postJournalEntry({
        voucherType: 'journal',
        date: '2026-02-15',
        lines: [
          { accountId: accounts.cash.id, side: 'debit', amountMinor: 222 },
          { accountId: accounts.capital.id, side: 'credit', amountMinor: 222 },
        ],
      });
      await postJournalEntry({
        voucherType: 'journal',
        date: '2026-02-28',
        lines: [
          { accountId: accounts.cash.id, side: 'debit', amountMinor: 333 },
          { accountId: accounts.capital.id, side: 'credit', amountMinor: 333 },
        ],
      });
    });

    it('excludes entries before the period', () => {
      const report = getTrialBalance('2026-02-16', '2026-02-28');
      expect(report.totalDebitsMinor).toBe(333);
    });

    it('excludes entries after the period', () => {
      const report = getTrialBalance('2026-02-01', '2026-02-14');
      expect(report.totalDebitsMinor).toBe(111);
    });

    it('includes the start-date boundary', () => {
      const report = getTrialBalance('2026-02-01', '2026-02-01');
      expect(report.totalDebitsMinor).toBe(111);
    });

    it('includes the end-date boundary', () => {
      const report = getTrialBalance('2026-02-28', '2026-02-28');
      expect(report.totalDebitsMinor).toBe(333);
    });

    it('returns zeros for a period with no activity', () => {
      const report = getTrialBalance('2026-03-01', '2026-03-31');
      expect(report.rows).toEqual([]);
      expect(report.totalDebitsMinor).toBe(0);
      expect(report.totalCreditsMinor).toBe(0);
      expect(report.isBalanced).toBe(true);
    });
  });

  it('handles representative money amounts without floating-point drift', async () => {
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-03-01',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 1 }, // ₹0.01
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 1 },
      ],
    });
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-03-02',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 50000 }, // ₹500
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 50000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-03-03',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 125050 }, // ₹1,250.50
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 125050 },
      ],
    });
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-03-04',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 900719925474 }, // large safe integer
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 900719925474 },
      ],
    });

    const report = getTrialBalance('2026-03-01', '2026-03-31');
    const expectedTotal = 1 + 50000 + 125050 + 900719925474;
    expect(report.totalDebitsMinor).toBe(expectedTotal);
    expect(report.totalCreditsMinor).toBe(expectedTotal);
    expect(Number.isInteger(report.totalDebitsMinor)).toBe(true);
    expect(Number.isSafeInteger(report.totalDebitsMinor)).toBe(true);
  });
});
