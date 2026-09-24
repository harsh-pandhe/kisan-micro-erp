/**
 * Shared, read-only SQL aggregation primitives for the reports module.
 * Every report (`trial-balance.ts`, `profit-loss.ts`, `balance-sheet.ts`)
 * goes through these instead of hand-rolling its own query or pulling
 * whole tables into JS. No writes anywhere in this file.
 */
import { getDatabase } from '../../db/database';
import type { SqlValue } from '../../db/types';
import { listAccounts } from '../accounting/accounts';
import { isDebitNormal } from '../accounting/types';
import type { Account, AccountType } from '../accounting/types';

export interface AccountActivity {
  accountId: number;
  debitTotal: number;
  creditTotal: number;
}

interface ActivityRow extends Record<string, SqlValue> {
  account_id: number;
  side: string;
  total: number;
}

/**
 * Sums debit/credit journal-line totals per account, restricted to journal
 * entries whose `date` falls within `[startDate, endDate]` inclusive (both
 * ends), compared as the ISO date strings are stored — no `Date` object
 * comparisons, so no timezone drift. Only accounts with at least one line
 * in range are returned. Parameterized query; no string-built SQL.
 */
export function getAccountActivityInPeriod(startDate: string, endDate: string): AccountActivity[] {
  const db = getDatabase();
  const rows = db.query<ActivityRow>(
    `SELECT jl.account_id as account_id, jl.side as side,
            COALESCE(SUM(jl.amount_minor), 0) as total
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.date >= ? AND je.date <= ?
     GROUP BY jl.account_id, jl.side`,
    [startDate, endDate],
  );

  const byAccount = new Map<number, AccountActivity>();
  for (const row of rows) {
    let entry = byAccount.get(row.account_id);
    if (!entry) {
      entry = { accountId: row.account_id, debitTotal: 0, creditTotal: 0 };
      byAccount.set(row.account_id, entry);
    }
    if (row.side === 'debit') entry.debitTotal = row.total;
    else entry.creditTotal = row.total;
  }
  return [...byAccount.values()];
}

/**
 * Same as `getAccountActivityInPeriod` but from inception (no lower bound)
 * through `asOfDate` inclusive — used for the Balance Sheet's point-in-time
 * view and for computing cumulative profit/loss up to a date.
 */
export function getAccountActivityAsOf(asOfDate: string): AccountActivity[] {
  const db = getDatabase();
  const rows = db.query<ActivityRow>(
    `SELECT jl.account_id as account_id, jl.side as side,
            COALESCE(SUM(jl.amount_minor), 0) as total
     FROM journal_lines jl
     JOIN journal_entries je ON je.id = jl.journal_entry_id
     WHERE je.date <= ?
     GROUP BY jl.account_id, jl.side`,
    [asOfDate],
  );

  const byAccount = new Map<number, AccountActivity>();
  for (const row of rows) {
    let entry = byAccount.get(row.account_id);
    if (!entry) {
      entry = { accountId: row.account_id, debitTotal: 0, creditTotal: 0 };
      byAccount.set(row.account_id, entry);
    }
    if (row.side === 'debit') entry.debitTotal = row.total;
    else entry.creditTotal = row.total;
  }
  return [...byAccount.values()];
}

/** Signed closing balance for one account's activity, per M3's normal-balance convention. */
export function signedBalance(type: AccountType, activity: AccountActivity): number {
  return isDebitNormal(type)
    ? activity.debitTotal - activity.creditTotal
    : activity.creditTotal - activity.debitTotal;
}

/** All accounts, ordered deterministically by code (matches `listAccounts()`). */
export function getAllAccountsOrdered(): Account[] {
  return listAccounts();
}
