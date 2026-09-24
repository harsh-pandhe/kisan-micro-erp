/**
 * Trial Balance: every account with journal activity in `[startDate,
 * endDate]` (inclusive both ends), with its debit/credit totals and signed
 * closing balance. Derives strictly from journal_lines/journal_entries —
 * see docs/milestone-7.md.
 */
import { getAccountActivityInPeriod, getAllAccountsOrdered, signedBalance } from './queries';
import type { ReportPeriod, TrialBalance, TrialBalanceRow } from './types';

export function getTrialBalance(startDate: string, endDate: string): TrialBalance {
  const period: ReportPeriod = { startDate, endDate };
  const activity = getAccountActivityInPeriod(startDate, endDate);
  const activityByAccount = new Map(activity.map((a) => [a.accountId, a]));

  const accounts = getAllAccountsOrdered();
  const rows: TrialBalanceRow[] = [];
  let totalDebitsMinor = 0;
  let totalCreditsMinor = 0;

  for (const account of accounts) {
    const act = activityByAccount.get(account.id);
    if (!act) continue;
    rows.push({
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      accountType: account.type,
      debitTotal: act.debitTotal,
      creditTotal: act.creditTotal,
      closingBalanceMinor: signedBalance(account.type, act),
    });
    totalDebitsMinor += act.debitTotal;
    totalCreditsMinor += act.creditTotal;
  }

  return {
    period,
    rows,
    totalDebitsMinor,
    totalCreditsMinor,
    isBalanced: totalDebitsMinor === totalCreditsMinor,
  };
}
