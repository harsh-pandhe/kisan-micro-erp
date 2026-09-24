import { PageHeader } from '../components/PageHeader';
import { EmptyState } from '../components/EmptyState';

export function AccountsPage() {
  return (
    <>
      <PageHeader
        title="Accounts"
        description="Your Chart of Accounts: cash, bank, customers, suppliers, income and expense heads."
      />
      <EmptyState
        title="Chart of Accounts not set up yet"
        description="Default ledgers and account creation land with the accounting engine milestone."
      />
    </>
  );
}
