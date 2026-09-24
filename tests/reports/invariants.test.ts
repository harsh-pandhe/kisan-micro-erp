import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDatabase } from '../../src/db/database';
import { postJournalEntry } from '../../src/features/accounting/posting';
import { AccountNotFoundError } from '../../src/features/accounting/errors';
import { recordTransaction } from '../../src/features/transactions/service';
import { getTrialBalance } from '../../src/features/reports/trial-balance';
import { getProfitAndLoss } from '../../src/features/reports/profit-loss';
import { getBalanceSheet } from '../../src/features/reports/balance-sheet';
import { freshDb, clearPersistedDb, seedAccounts, type SeededAccounts } from './helpers';

describe('reports: rejected-transaction exclusion', () => {
  let accounts: SeededAccounts;

  beforeEach(async () => {
    await freshDb();
    accounts = seedAccounts();
  });
  afterEach(async () => {
    await clearPersistedDb();
  });

  it('a rejected transaction never appears in or affects any report', async () => {
    const bogusAccountId = 999999; // does not exist -> posting fails, transaction is rejected

    await expect(
      recordTransaction({
        rawText: 'Paid 500 cash for fertilizer',
        inputMethod: 'text',
        type: 'payment',
        amountMinor: 50000,
        date: '2026-01-15',
        classifiedAccountId: accounts.purchases.id,
        counterAccountId: bogusAccountId,
      }),
    ).rejects.toThrow(AccountNotFoundError);

    // Sanity: the rejection really happened and left no journal data.
    const db = getDatabase();
    const [{ count }] = db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM journal_entries',
    );
    expect(count).toBe(0);

    const trialBalance = getTrialBalance('2026-01-01', '2026-01-31');
    expect(trialBalance.rows).toEqual([]);
    expect(trialBalance.totalDebitsMinor).toBe(0);
    expect(trialBalance.isBalanced).toBe(true);

    const pnl = getProfitAndLoss('2026-01-01', '2026-01-31');
    expect(pnl.totalIncomeMinor).toBe(0);
    expect(pnl.totalExpensesMinor).toBe(0);
    expect(pnl.netProfitMinor).toBe(0);

    const balanceSheet = getBalanceSheet('2026-01-31');
    expect(balanceSheet.totalAssetsMinor).toBe(0);
    expect(balanceSheet.totalLiabilitiesMinor).toBe(0);
    expect(balanceSheet.totalEquityMinor).toBe(0);
    expect(balanceSheet.isBalanced).toBe(true);
  });

  it('a successfully posted transaction alongside a rejected one only reflects the posted one', async () => {
    // First: a successful transaction.
    await recordTransaction({
      rawText: 'Paid 100 cash for purchase',
      inputMethod: 'text',
      type: 'payment',
      amountMinor: 10000,
      date: '2026-01-10',
      classifiedAccountId: accounts.purchases.id,
      counterAccountId: accounts.cash.id,
    });

    // Then: a rejected one (bogus counter account).
    await expect(
      recordTransaction({
        rawText: 'Paid 500 cash for fertilizer',
        inputMethod: 'text',
        type: 'payment',
        amountMinor: 50000,
        date: '2026-01-15',
        classifiedAccountId: accounts.purchases.id,
        counterAccountId: 999999,
      }),
    ).rejects.toThrow(AccountNotFoundError);

    const pnl = getProfitAndLoss('2026-01-01', '2026-01-31');
    expect(pnl.totalExpensesMinor).toBe(10000); // only the posted 100, not 500
  });
});

describe('reports: empty state', () => {
  beforeEach(async () => {
    await freshDb();
  });
  afterEach(async () => {
    await clearPersistedDb();
  });

  it('with zero accounts and zero transactions, all reports show clean zero values', () => {
    const trialBalance = getTrialBalance('2026-01-01', '2026-12-31');
    expect(trialBalance.rows).toEqual([]);
    expect(trialBalance.totalDebitsMinor).toBe(0);
    expect(trialBalance.totalCreditsMinor).toBe(0);
    expect(trialBalance.isBalanced).toBe(true);

    const pnl = getProfitAndLoss('2026-01-01', '2026-12-31');
    expect(pnl.totalIncomeMinor).toBe(0);
    expect(pnl.totalExpensesMinor).toBe(0);
    expect(pnl.netProfitMinor).toBe(0);
    expect(Number.isFinite(pnl.netProfitMinor)).toBe(true);

    const balanceSheet = getBalanceSheet('2026-12-31');
    expect(balanceSheet.totalAssetsMinor).toBe(0);
    expect(balanceSheet.totalLiabilitiesMinor).toBe(0);
    expect(balanceSheet.totalEquityMinor).toBe(0);
    expect(balanceSheet.isBalanced).toBe(true);
    [
      trialBalance.totalDebitsMinor,
      pnl.netProfitMinor,
      balanceSheet.totalAssetsMinor,
      balanceSheet.totalEquityMinor,
    ].forEach((value) => {
      expect(Number.isNaN(value)).toBe(false);
      expect(Number.isFinite(value)).toBe(true);
    });
  });
});

describe('reports: cross-report consistency (shared fixture)', () => {
  let accounts: SeededAccounts;

  beforeEach(async () => {
    await freshDb();
    accounts = seedAccounts();

    // Fixture: capital introduced, a cash purchase/expense, a cash sale,
    // and a payment against the supplier creditor — all through M3's
    // journal primitives, spanning the same reporting period.
    await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-01',
      narration: 'Capital introduced',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 1000000 },
        { accountId: accounts.capital.id, side: 'credit', amountMinor: 1000000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'purchase',
      date: '2026-01-05',
      lines: [
        { accountId: accounts.purchases.id, side: 'debit', amountMinor: 30000 },
        { accountId: accounts.creditor.id, side: 'credit', amountMinor: 30000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'sale',
      date: '2026-01-10',
      lines: [
        { accountId: accounts.cash.id, side: 'debit', amountMinor: 75000 },
        { accountId: accounts.sales.id, side: 'credit', amountMinor: 75000 },
      ],
    });
    await postJournalEntry({
      voucherType: 'payment',
      date: '2026-01-20',
      lines: [
        { accountId: accounts.creditor.id, side: 'debit', amountMinor: 30000 },
        { accountId: accounts.cash.id, side: 'credit', amountMinor: 30000 },
      ],
    });
  });
  afterEach(async () => {
    await clearPersistedDb();
  });

  it('Trial Balance balances (debits = credits)', () => {
    const trialBalance = getTrialBalance('2026-01-01', '2026-01-31');
    expect(trialBalance.totalDebitsMinor).toBe(trialBalance.totalCreditsMinor);
    expect(trialBalance.isBalanced).toBe(true);
  });

  it('P&L income/expense figures match the fixture journal data exactly', () => {
    const pnl = getProfitAndLoss('2026-01-01', '2026-01-31');
    expect(pnl.totalIncomeMinor).toBe(75000);
    expect(pnl.totalExpensesMinor).toBe(30000);
    expect(pnl.netProfitMinor).toBe(45000);
  });

  it('Balance Sheet satisfies Assets = Liabilities + Equity', () => {
    const balanceSheet = getBalanceSheet('2026-01-31');
    expect(balanceSheet.totalAssetsMinor).toBe(
      balanceSheet.totalLiabilitiesMinor + balanceSheet.totalEquityMinor,
    );
    expect(balanceSheet.isBalanced).toBe(true);
  });

  it('current-period profit/loss is identical between P&L and the Balance Sheet equity presentation', () => {
    const pnl = getProfitAndLoss('2026-01-01', '2026-01-31');
    const balanceSheet = getBalanceSheet('2026-01-31');
    expect(balanceSheet.currentPeriodProfitMinor).toBe(pnl.netProfitMinor);
  });

  it('all three reports derive from the same underlying journal data (no drift between them)', () => {
    const trialBalance = getTrialBalance('2026-01-01', '2026-01-31');
    const pnl = getProfitAndLoss('2026-01-01', '2026-01-31');
    const balanceSheet = getBalanceSheet('2026-01-31');

    const cashRow = trialBalance.rows.find((r) => r.accountId === accounts.cash.id)!;
    const cashOnBalanceSheet = balanceSheet.assets.find((a) => a.accountId === accounts.cash.id)!;
    expect(cashRow.closingBalanceMinor).toBe(cashOnBalanceSheet.amountMinor);

    const salesRowTB = trialBalance.rows.find((r) => r.accountId === accounts.sales.id)!;
    const salesOnPnl = pnl.income.find((a) => a.accountId === accounts.sales.id)!;
    expect(salesRowTB.closingBalanceMinor).toBe(salesOnPnl.amountMinor);
  });
});
