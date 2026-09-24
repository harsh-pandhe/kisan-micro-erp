import { useMemo, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { EmptyState } from '../components/EmptyState';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { StatusBadge } from '../components/StatusBadge';
import { ReportTable } from '../components/ReportTable';
import { formatMinor } from '../components/formatMinor';
import {
  getTrialBalance,
  getProfitAndLoss,
  getBalanceSheet,
  type TrialBalance,
  type ProfitAndLoss,
  type BalanceSheet,
} from '../features/reports';

type ReportTab = 'trial-balance' | 'profit-loss' | 'balance-sheet';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'trial-balance', label: 'Trial Balance' },
  { id: 'profit-loss', label: 'Profit & Loss' },
  { id: 'balance-sheet', label: 'Balance Sheet' },
];

/** Default period: the current calendar month, by fixed local date parts (no Date-object date math on stored rows). */
function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    start: `${year}-${month}-01`,
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
  };
}

function safeRun<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}

function TrialBalanceView({ report }: { report: TrialBalance }) {
  if (report.rows.length === 0) {
    return (
      <EmptyState
        title="No activity in this period"
        description="No journal entries were posted between the selected dates."
      />
    );
  }
  return (
    <>
      <ReportTable caption="Trial Balance" columns={['Account', 'Debit', 'Credit']}>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.accountId}>
              <td>
                {row.accountName} <span aria-hidden="true">({row.accountCode})</span>
              </td>
              <td>{row.debitTotal > 0 ? formatMinor(row.debitTotal) : '—'}</td>
              <td>{row.creditTotal > 0 ? formatMinor(row.creditTotal) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td>{formatMinor(report.totalDebitsMinor)}</td>
            <td>{formatMinor(report.totalCreditsMinor)}</td>
          </tr>
        </tfoot>
      </ReportTable>
      <div className="report-status-line">
        <StatusBadge tone={report.isBalanced ? 'positive' : 'warning'}>
          {report.isBalanced ? 'Balanced' : 'Out of balance'}
        </StatusBadge>
      </div>
    </>
  );
}

function ProfitAndLossView({ report }: { report: ProfitAndLoss }) {
  return (
    <>
      <ReportTable caption="Income" columns={['Account', 'Amount']}>
        <tbody>
          {report.income.length === 0 ? (
            <tr>
              <td colSpan={2}>No income posted in this period.</td>
            </tr>
          ) : (
            report.income.map((row) => (
              <tr key={row.accountId}>
                <td>{row.accountName}</td>
                <td>{formatMinor(row.amountMinor)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>Total Income</td>
            <td>{formatMinor(report.totalIncomeMinor)}</td>
          </tr>
        </tfoot>
      </ReportTable>

      <ReportTable caption="Expenses" columns={['Account', 'Amount']}>
        <tbody>
          {report.expenses.length === 0 ? (
            <tr>
              <td colSpan={2}>No expenses posted in this period.</td>
            </tr>
          ) : (
            report.expenses.map((row) => (
              <tr key={row.accountId}>
                <td>{row.accountName}</td>
                <td>{formatMinor(row.amountMinor)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>Total Expenses</td>
            <td>{formatMinor(report.totalExpensesMinor)}</td>
          </tr>
        </tfoot>
      </ReportTable>

      <div className="report-summary-row">
        <strong>Net {report.netProfitMinor >= 0 ? 'Profit' : 'Loss'}</strong>
        <strong>{formatMinor(Math.abs(report.netProfitMinor))}</strong>
      </div>
    </>
  );
}

function BalanceSheetView({ report }: { report: BalanceSheet }) {
  return (
    <>
      <ReportTable caption="Assets" columns={['Account', 'Amount']}>
        <tbody>
          {report.assets.length === 0 ? (
            <tr>
              <td colSpan={2}>No asset balances as of this date.</td>
            </tr>
          ) : (
            report.assets.map((row) => (
              <tr key={row.accountId}>
                <td>{row.accountName}</td>
                <td>{formatMinor(row.amountMinor)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>Total Assets</td>
            <td>{formatMinor(report.totalAssetsMinor)}</td>
          </tr>
        </tfoot>
      </ReportTable>

      <ReportTable caption="Liabilities" columns={['Account', 'Amount']}>
        <tbody>
          {report.liabilities.length === 0 ? (
            <tr>
              <td colSpan={2}>No liability balances as of this date.</td>
            </tr>
          ) : (
            report.liabilities.map((row) => (
              <tr key={row.accountId}>
                <td>{row.accountName}</td>
                <td>{formatMinor(row.amountMinor)}</td>
              </tr>
            ))
          )}
        </tbody>
        <tfoot>
          <tr>
            <td>Total Liabilities</td>
            <td>{formatMinor(report.totalLiabilitiesMinor)}</td>
          </tr>
        </tfoot>
      </ReportTable>

      <ReportTable caption="Equity" columns={['Account', 'Amount']}>
        <tbody>
          {report.equity.map((row) => (
            <tr key={row.accountId}>
              <td>{row.accountName}</td>
              <td>{formatMinor(row.amountMinor)}</td>
            </tr>
          ))}
          <tr>
            <td>Current period profit/loss</td>
            <td>{formatMinor(report.currentPeriodProfitMinor)}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr>
            <td>Total Equity</td>
            <td>{formatMinor(report.totalEquityMinor)}</td>
          </tr>
        </tfoot>
      </ReportTable>

      <div className="report-summary-row">
        <span>Assets vs Liabilities + Equity</span>
        <span>
          {formatMinor(report.totalAssetsMinor)} vs{' '}
          {formatMinor(report.totalLiabilitiesMinor + report.totalEquityMinor)}
        </span>
      </div>
      <div className="report-status-line">
        <StatusBadge tone={report.isBalanced ? 'positive' : 'warning'}>
          {report.isBalanced ? 'Balanced' : 'Out of balance'}
        </StatusBadge>
      </div>
    </>
  );
}

export function ReportsPage() {
  const [tab, setTab] = useState<ReportTab>('trial-balance');
  const [{ start: initialStart, end: initialEnd }] = useState(defaultPeriod);
  const [startDate, setStartDate] = useState(initialStart);
  const [endDate, setEndDate] = useState(initialEnd);
  const [asOfDate, setAsOfDate] = useState(initialEnd);

  // Re-query current SQLite state whenever the active tab or the relevant
  // period/as-of date changes, so the page never shows stale report data.
  const trialBalance = useMemo<TrialBalance | null>(
    () =>
      tab === 'trial-balance' ? safeRun(() => getTrialBalance(startDate, endDate), null) : null,
    [tab, startDate, endDate],
  );
  const profitAndLoss = useMemo<ProfitAndLoss | null>(
    () =>
      tab === 'profit-loss' ? safeRun(() => getProfitAndLoss(startDate, endDate), null) : null,
    [tab, startDate, endDate],
  );
  const balanceSheet = useMemo<BalanceSheet | null>(
    () => (tab === 'balance-sheet' ? safeRun(() => getBalanceSheet(asOfDate), null) : null),
    [tab, asOfDate],
  );

  return (
    <>
      <PageHeader
        title="Reports"
        description="Trial Balance, Profit & Loss and Balance Sheet, generated from posted journal entries."
      />

      <nav className="report-tabs" aria-label="Report type">
        {TABS.map((t) => (
          <Button
            key={t.id}
            type="button"
            variant={tab === t.id ? 'primary' : 'secondary'}
            aria-pressed={tab === t.id}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </nav>

      <Card>
        {tab === 'balance-sheet' ? (
          <form className="report-period-form" onSubmit={(e) => e.preventDefault()}>
            <Input
              label="As of date"
              type="date"
              value={asOfDate}
              onChange={(e) => setAsOfDate(e.target.value)}
            />
          </form>
        ) : (
          <form className="report-period-form" onSubmit={(e) => e.preventDefault()}>
            <Input
              label="Start date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
            <Input
              label="End date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </form>
        )}

        {tab === 'trial-balance' &&
          (trialBalance ? (
            <TrialBalanceView report={trialBalance} />
          ) : (
            <EmptyState title="Loading…" description="Reading the current ledger state." />
          ))}
        {tab === 'profit-loss' &&
          (profitAndLoss ? (
            <ProfitAndLossView report={profitAndLoss} />
          ) : (
            <EmptyState title="Loading…" description="Reading the current ledger state." />
          ))}
        {tab === 'balance-sheet' &&
          (balanceSheet ? (
            <BalanceSheetView report={balanceSheet} />
          ) : (
            <EmptyState title="Loading…" description="Reading the current ledger state." />
          ))}
      </Card>
    </>
  );
}
