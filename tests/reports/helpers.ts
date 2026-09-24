import 'fake-indexeddb/auto';
import { closeDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import { createAccount } from '../../src/features/accounting/accounts';
import type { Account } from '../../src/features/accounting/types';

export async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

export async function freshDb(): Promise<void> {
  closeDatabase();
  await clearPersistedDb();
  await initializeDatabase();
}

export interface SeededAccounts {
  cash: Account;
  capital: Account;
  sales: Account;
  purchases: Account;
  creditor: Account;
}

/** Standard chart of accounts shared across report fixtures. */
export function seedAccounts(): SeededAccounts {
  const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
  const capital = createAccount({ code: '3000', name: 'Capital', type: 'equity' });
  const sales = createAccount({ code: '4000', name: 'Sales', type: 'income' });
  const purchases = createAccount({ code: '5000', name: 'Purchases', type: 'expense' });
  const creditor = createAccount({ code: '2000', name: 'Supplier Creditor', type: 'liability' });
  return { cash, capital, sales, purchases, creditor };
}
