import { useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { TransactionHistory } from '../components/TransactionHistory';
import { countTransactions, listTransactionHistory } from '../features/transactions';
import type { TransactionHistoryItem } from '../features/transactions';

/**
 * Dashboard shows only cheap, already-persisted figures — a transaction
 * count and a few recent transactions. No Trial Balance/P&L/Balance Sheet
 * aggregation here; that's Milestone 7.
 */
export function DashboardPage() {
  const [count] = useState(() => {
    try {
      return countTransactions();
    } catch {
      return 0;
    }
  });
  const [recent] = useState<TransactionHistoryItem[]>(() => {
    try {
      return listTransactionHistory(5);
    } catch {
      return [];
    }
  });

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="A snapshot of your books. Reports (P&L, Balance Sheet) come in a later milestone."
      />
      <div className="stat-grid">
        <Card title="Transactions recorded">
          <p className="stat-placeholder">{count}</p>
        </Card>
        <Card title="Database">
          <p className="stat-placeholder">Ready</p>
        </Card>
      </div>
      <Card title="Recent Transactions" className="stack-gap">
        <TransactionHistory items={recent} />
      </Card>
    </>
  );
}
