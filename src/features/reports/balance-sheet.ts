/**
 * Balance Sheet: Assets, Liabilities and Equity as of a point in time
 * (every journal entry dated on or before `asOfDate`). There is no
 * closing-entry machinery in Phase 1, so current-period profit/loss is
 * presented as a computed Equity line rather than posted — see
 * docs/milestone-7.md, "Current-period profit presentation".
 */
import { getAccountActivityAsOf, getAllAccountsOrdered, signedBalance } from './queries';
import { getProfitAndLoss } from './profit-loss';
import type { AccountAmount, BalanceSheet } from './types';

/**
 * Lexicographically precedes any real `YYYY-MM-DD` journal entry date, so
 * `getProfitAndLoss(INCEPTION, asOfDate)` covers "since inception" without
 * a nullable/open-ended date parameter in the report query layer.
 */
const INCEPTION_DATE = '0000-01-01';

export function getBalanceSheet(asOfDate: string): BalanceSheet {
  const activity = getAccountActivityAsOf(asOfDate);
  const activityByAccount = new Map(activity.map((a) => [a.accountId, a]));

  const assets: AccountAmount[] = [];
  const liabilities: AccountAmount[] = [];
  const equity: AccountAmount[] = [];

  for (const account of getAllAccountsOrdered()) {
    const act = activityByAccount.get(account.id);
    if (!act) continue;
    if (account.type !== 'asset' && account.type !== 'liability' && account.type !== 'equity') {
      continue;
    }

    const amountMinor = signedBalance(account.type, act);
    const line: AccountAmount = {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      amountMinor,
    };
    if (account.type === 'asset') assets.push(line);
    else if (account.type === 'liability') liabilities.push(line);
    else equity.push(line);
  }

  const totalAssetsMinor = assets.reduce((sum, a) => sum + a.amountMinor, 0);
  const totalLiabilitiesMinor = liabilities.reduce((sum, a) => sum + a.amountMinor, 0);
  const postedEquityMinor = equity.reduce((sum, a) => sum + a.amountMinor, 0);

  const currentPeriodProfitMinor = getProfitAndLoss(INCEPTION_DATE, asOfDate).netProfitMinor;
  const totalEquityMinor = postedEquityMinor + currentPeriodProfitMinor;

  return {
    asOfDate,
    assets,
    liabilities,
    equity,
    currentPeriodProfitMinor,
    totalAssetsMinor,
    totalLiabilitiesMinor,
    totalEquityMinor,
    isBalanced: totalAssetsMinor === totalLiabilitiesMinor + totalEquityMinor,
  };
}
