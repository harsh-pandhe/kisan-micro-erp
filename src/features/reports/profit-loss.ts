/**
 * Profit & Loss: Income and Expense accounts with activity in
 * `[startDate, endDate]` inclusive, computed from posted journal lines
 * only (never the transactions table or classification mappings). See
 * docs/milestone-7.md.
 */
import { getAccountActivityInPeriod, getAllAccountsOrdered, signedBalance } from './queries';
import type { AccountAmount, ProfitAndLoss, ReportPeriod } from './types';

export function getProfitAndLoss(startDate: string, endDate: string): ProfitAndLoss {
  const period: ReportPeriod = { startDate, endDate };
  const activity = getAccountActivityInPeriod(startDate, endDate);
  const activityByAccount = new Map(activity.map((a) => [a.accountId, a]));

  const income: AccountAmount[] = [];
  const expenses: AccountAmount[] = [];

  for (const account of getAllAccountsOrdered()) {
    const act = activityByAccount.get(account.id);
    if (!act) continue;
    if (account.type !== 'income' && account.type !== 'expense') continue;

    const amountMinor = signedBalance(account.type, act);
    const line: AccountAmount = {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      amountMinor,
    };
    if (account.type === 'income') income.push(line);
    else expenses.push(line);
  }

  const totalIncomeMinor = income.reduce((sum, a) => sum + a.amountMinor, 0);
  const totalExpensesMinor = expenses.reduce((sum, a) => sum + a.amountMinor, 0);

  return {
    period,
    income,
    expenses,
    totalIncomeMinor,
    totalExpensesMinor,
    netProfitMinor: totalIncomeMinor - totalExpensesMinor,
  };
}
