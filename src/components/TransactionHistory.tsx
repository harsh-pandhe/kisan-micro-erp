import type { TransactionHistoryItem } from '../features/transactions';
import { Card } from './Card';
import { EmptyState } from './EmptyState';
import { StatusBadge } from './StatusBadge';

interface TransactionHistoryProps {
  items: TransactionHistoryItem[];
}

function formatAmount(minorUnits: number | null): string {
  if (minorUnits === null) return '—';
  return `₹${(minorUnits / 100).toFixed(2)}`;
}

function statusTone(status: TransactionHistoryItem['status']): 'positive' | 'warning' | 'neutral' {
  if (status === 'posted') return 'positive';
  if (status === 'rejected') return 'warning';
  return 'neutral';
}

/** Read-only, newest-first list of persisted transactions, via the typed transaction-history query. */
export function TransactionHistory({ items }: TransactionHistoryProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No transactions yet"
        description="Recorded transactions will show up here, newest first."
      />
    );
  }

  return (
    <ul className="transaction-history">
      {items.map((item) => (
        <li key={item.id} className="transaction-history__item">
          <Card>
            <div className="transaction-history__row">
              <span className="transaction-history__date">
                {item.date ?? item.createdAt.slice(0, 10)}
              </span>
              <StatusBadge tone={statusTone(item.status)}>{item.status}</StatusBadge>
            </div>
            <p className="transaction-history__desc">
              {item.voucherType ? `${item.voucherType}: ` : ''}
              {item.narration ?? item.rawText}
            </p>
            <p className="transaction-history__amount">{formatAmount(item.amountMinor)}</p>
          </Card>
        </li>
      ))}
    </ul>
  );
}
