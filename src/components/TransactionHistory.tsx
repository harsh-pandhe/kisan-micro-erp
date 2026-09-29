import { Receipt } from 'lucide-react';
import type { TransactionHistoryItem } from '../features/transactions';
import { Badge } from './ui/badge';
import { UiButton } from './ui/button';
import { EmptyState } from './EmptyState';

interface TransactionHistoryProps {
  items: TransactionHistoryItem[];
}

function formatAmount(minorUnits: number | null): string {
  if (minorUnits === null) return '—';
  return `₹${(minorUnits / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
}

// Income-side voucher types receive money in; expense-side pay money out.
// Only types the M6 parser actually produces are covered — anything else
// (or no voucher type at all) is left without a sign rather than guessed.
const DIRECTION: Record<string, '+' | '-'> = {
  sale: '+',
  receipt: '+',
  purchase: '-',
  payment: '-',
};

function statusVariant(
  status: TransactionHistoryItem['status'],
): 'success' | 'warning' | 'default' {
  if (status === 'posted') return 'success';
  if (status === 'rejected') return 'warning';
  return 'default';
}

function dateGroup(iso: string): 'Today' | 'Yesterday' | 'Earlier' {
  const day = iso.slice(0, 10);
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (day === today) return 'Today';
  if (day === yesterday) return 'Yesterday';
  return 'Earlier';
}

/** Read-only, newest-first list of persisted transactions, via the typed transaction-history query. */
export function TransactionHistory({ items }: TransactionHistoryProps) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<Receipt className="size-8" aria-hidden="true" />}
        title="No transactions yet"
        description="Your recorded transactions will appear here."
        action={
          <UiButton
            type="button"
            size="sm"
            onClick={() =>
              document.getElementById('transaction-composer')?.focus({ preventScroll: false })
            }
          >
            Add transaction
          </UiButton>
        }
      />
    );
  }

  const rows = items.map((item, index) => {
    const group = dateGroup(item.createdAt);
    const previousGroup = index > 0 ? dateGroup(items[index - 1].createdAt) : null;
    return { item, group, showGroupLabel: group !== previousGroup };
  });

  return (
    <ul className="flex flex-col divide-y divide-border rounded-[var(--radius-lg)] border border-border bg-card">
      {rows.map(({ item, group, showGroupLabel }) => {
        const sign = item.voucherType ? DIRECTION[item.voucherType] : undefined;

        return (
          <li key={item.id}>
            {showGroupLabel ? (
              <p className="px-4 pt-3 text-caption font-semibold uppercase tracking-wide text-muted-foreground">
                {group}
              </p>
            ) : null}
            <div className="flex items-center gap-3 px-4 py-3">
              <Receipt className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-body-small font-medium text-foreground">
                  {item.narration ?? item.rawText}
                </p>
                <p className="text-caption text-muted-foreground">
                  {item.date ?? item.createdAt.slice(0, 10)}
                  {item.voucherType ? ` · ${item.voucherType}` : ''}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="financial-number text-body-small text-foreground">
                  {sign ? `${sign} ` : ''}
                  {formatAmount(item.amountMinor)}
                </span>
                <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
