import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import {
  createAccount,
  findAccountByName,
  getAccount,
  listAccounts,
} from '../../src/features/accounting/accounts';
import { DuplicateAccountError, ValidationError } from '../../src/features/accounting/errors';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('accounts', () => {
  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('creates a valid asset account', () => {
    const account = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    expect(account.id).toBeGreaterThan(0);
    expect(account.type).toBe('asset');
    expect(account.name).toBe('Cash');
    expect(getAccount(account.id)).toEqual(account);
  });

  it('creates a valid expense account', () => {
    const account = createAccount({ code: '5000', name: 'Purchases', type: 'expense' });
    expect(account.type).toBe('expense');
  });

  it('creates a valid income account', () => {
    const account = createAccount({ code: '4000', name: 'Sales', type: 'income' });
    expect(account.type).toBe('income');
  });

  it('rejects an invalid account type', () => {
    expect(() =>
      createAccount({ code: '9999', name: 'Bogus', type: 'not-a-type' as never }),
    ).toThrow(ValidationError);
  });

  it('rejects a missing name', () => {
    expect(() => createAccount({ code: '9999', name: '', type: 'asset' })).toThrow(ValidationError);
  });

  it('rejects a duplicate account code', () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    expect(() => createAccount({ code: '1000', name: 'Cash 2', type: 'asset' })).toThrow(
      DuplicateAccountError,
    );
  });

  it('lists accounts, optionally filtered by type', () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    createAccount({ code: '4000', name: 'Sales', type: 'income' });
    expect(listAccounts()).toHaveLength(2);
    expect(listAccounts('asset')).toHaveLength(1);
    expect(listAccounts('asset')[0].name).toBe('Cash');
  });

  it('finds an account by name', () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    expect(findAccountByName('Cash')?.code).toBe('1000');
    expect(findAccountByName('Nonexistent')).toBeNull();
  });
});
