import type { Account } from '../features/accounting';
import { Card } from './Card';
import { EmptyState } from './EmptyState';

interface AccountListProps {
  accounts: Account[];
}

/** Read-only list of the chart of accounts, grouped by type. */
export function AccountList({ accounts }: AccountListProps) {
  if (accounts.length === 0) {
    return (
      <EmptyState
        title="No accounts yet"
        description="Create your first account (e.g. Cash, Bank) below."
      />
    );
  }

  return (
    <ul className="account-list">
      {accounts.map((account) => (
        <li key={account.id} className="account-list__item">
          <Card>
            <div className="account-list__row">
              <span className="account-list__name">{account.name}</span>
              <span className="account-list__type">{account.type}</span>
            </div>
            <span className="account-list__code">{account.code}</span>
          </Card>
        </li>
      ))}
    </ul>
  );
}
