import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import { createAccount } from '../../src/features/accounting/accounts';
import type { Account } from '../../src/features/accounting/types';
import {
  createMapping,
  findMappingByNormalizedKey,
  listMappings,
  updateMapping,
  upsertMapping,
} from '../../src/features/classification/mappings';
import {
  MappingAccountNotFoundError,
  MappingValidationError,
} from '../../src/features/classification/types';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('item mapping CRUD', () => {
  let fertilizerExpense: Account;
  let dieselExpense: Account;

  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
    fertilizerExpense = createAccount({
      code: '5000',
      name: 'Fertilizer Expense',
      type: 'expense',
    });
    dieselExpense = createAccount({ code: '5001', name: 'Diesel Expense', type: 'expense' });
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('creates a mapping for a normalized key', () => {
    const mapping = createMapping('Fertilizer', fertilizerExpense.id);
    expect(mapping.itemNameNormalized).toBe('fertilizer');
    expect(mapping.accountId).toBe(fertilizerExpense.id);
    expect(findMappingByNormalizedKey('fertilizer')?.id).toBe(mapping.id);
  });

  it('rejects an empty source key', () => {
    expect(() => createMapping('   ', fertilizerExpense.id)).toThrow(MappingValidationError);
  });

  it('rejects mapping to a nonexistent account', () => {
    expect(() => createMapping('fertilizer', 999999)).toThrow(MappingAccountNotFoundError);
    expect(findMappingByNormalizedKey('fertilizer')).toBeNull();
  });

  it('rejects creating a duplicate mapping for the same normalized key', () => {
    createMapping('fertilizer', fertilizerExpense.id);
    expect(() => createMapping('fertilizer', dieselExpense.id)).toThrow(MappingValidationError);
  });

  it('updateMapping changes an existing mapping to a different account (explicit operation)', () => {
    createMapping('fertilizer', fertilizerExpense.id);
    const updated = updateMapping('fertilizer', dieselExpense.id);
    expect(updated.accountId).toBe(dieselExpense.id);
    expect(findMappingByNormalizedKey('fertilizer')?.accountId).toBe(dieselExpense.id);
  });

  it('updateMapping rejects updating a mapping that does not exist', () => {
    expect(() => updateMapping('does-not-exist', fertilizerExpense.id)).toThrow(
      MappingValidationError,
    );
  });

  it('upsertMapping creates when absent and updates when present, idempotently', () => {
    const created = upsertMapping('diesel', dieselExpense.id);
    expect(created.accountId).toBe(dieselExpense.id);

    // Same key, same account: idempotent no-op.
    const again = upsertMapping('diesel', dieselExpense.id);
    expect(again.id).toBe(created.id);
    expect(listMappings()).toHaveLength(1);

    // Same key, different account: explicit update.
    const changed = upsertMapping('diesel', fertilizerExpense.id);
    expect(changed.accountId).toBe(fertilizerExpense.id);
    expect(listMappings()).toHaveLength(1);
  });

  it('listMappings returns all stored mappings', () => {
    createMapping('fertilizer', fertilizerExpense.id);
    createMapping('diesel', dieselExpense.id);
    expect(
      listMappings()
        .map((m) => m.itemNameNormalized)
        .sort(),
    ).toEqual(['diesel', 'fertilizer']);
  });
});
