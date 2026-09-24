/**
 * Domain types for Milestone 7 reports. These are pure read-only
 * projections of Milestone 3's journal data — no new persistence, no new
 * accounting rules. See docs/milestone-7.md for the full design writeup.
 */
import type { Account, AccountType } from '../accounting/types';

/** Inclusive start/end date range, as stored (ISO `YYYY-MM-DD` strings). */
export interface ReportPeriod {
  startDate: string;
  endDate: string;
}

export interface TrialBalanceRow {
  accountId: number;
  accountCode: string;
  accountName: string;
  accountType: AccountType;
  /** Sum of debit-side journal lines for this account in the period (integer minor units). */
  debitTotal: number;
  /** Sum of credit-side journal lines for this account in the period (integer minor units). */
  creditTotal: number;
  /** Signed per the account's normal balance side, same convention as `getAccountBalance`. */
  closingBalanceMinor: number;
}

export interface TrialBalance {
  period: ReportPeriod;
  rows: TrialBalanceRow[];
  totalDebitsMinor: number;
  totalCreditsMinor: number;
  /** True when totalDebitsMinor === totalCreditsMinor. */
  isBalanced: boolean;
}

export interface AccountAmount {
  accountId: number;
  accountCode: string;
  accountName: string;
  /** Balance for the period/point in time, in integer minor units (always non-negative here). */
  amountMinor: number;
}

export interface ProfitAndLoss {
  period: ReportPeriod;
  income: AccountAmount[];
  expenses: AccountAmount[];
  totalIncomeMinor: number;
  totalExpensesMinor: number;
  /** totalIncomeMinor - totalExpensesMinor; positive is profit, negative is loss. */
  netProfitMinor: number;
}

export interface BalanceSheet {
  asOfDate: string;
  assets: AccountAmount[];
  liabilities: AccountAmount[];
  /** Equity accounts posted directly (e.g. Capital), excluding current-period profit/loss. */
  equity: AccountAmount[];
  /**
   * Net profit/loss from inception (the earliest possible date) through
   * `asOfDate`, presented as an Equity line since there is no closing-entry
   * machinery yet. See docs/milestone-7.md, "Current-period profit
   * presentation".
   */
  currentPeriodProfitMinor: number;
  totalAssetsMinor: number;
  totalLiabilitiesMinor: number;
  /** Sum of posted equity accounts plus currentPeriodProfitMinor. */
  totalEquityMinor: number;
  /** True when totalAssetsMinor === totalLiabilitiesMinor + totalEquityMinor. */
  isBalanced: boolean;
}

export type { Account, AccountType };
