import { useEffect, useState } from 'react';
import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { AccountList } from '../components/AccountList';
import { AccountForm } from '../components/AccountForm';
import { createAccount, getAllAccounts } from '../features/accounting';
import type { Account, AccountType } from '../features/accounting';
import { BACKUP_RESTORED_EVENT } from '../features/backup';

/** Reads accounts, tolerating a DB that isn't initialized yet (e.g. in isolated tests). */
function safeGetAllAccounts(): Account[] {
  try {
    return getAllAccounts();
  } catch {
    return [];
  }
}

export function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>(() => safeGetAllAccounts());

  function refresh() {
    setAccounts(safeGetAllAccounts());
  }

  // Re-read the chart of accounts after a backup restore swaps the active
  // database, so this page never shows accounts from the pre-restore DB.
  useEffect(() => {
    window.addEventListener(BACKUP_RESTORED_EVENT, refresh);
    return () => window.removeEventListener(BACKUP_RESTORED_EVENT, refresh);
  }, []);

  async function handleCreate(input: { code: string; name: string; type: AccountType }) {
    createAccount(input);
    refresh();
  }

  return (
    <>
      <PageHeader
        title="Accounts"
        description="Your Chart of Accounts: cash, bank, customers, suppliers, income and expense heads."
      />
      <AccountList accounts={accounts} />
      <Card title="Add an account" className="stack-gap">
        <AccountForm onSubmit={handleCreate} />
      </Card>
    </>
  );
}
