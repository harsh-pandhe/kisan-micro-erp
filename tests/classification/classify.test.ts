import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import { createAccount } from '../../src/features/accounting/accounts';
import type { Account } from '../../src/features/accounting/types';
import { classify } from '../../src/features/classification/classify';
import { createMapping } from '../../src/features/classification/mappings';
import type { ParsedTransaction } from '../../src/parser/types';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function makeTransaction(overrides: Partial<ParsedTransaction> = {}): ParsedTransaction {
  return {
    type: 'purchase',
    amount: { minorUnits: 50000, currency: 'INR' },
    party: undefined,
    description: undefined,
    date: '2026-01-01',
    paymentMode: 'cash',
    rawText: 'bought fertilizer for 500',
    normalizedText: 'bought fertilizer for 500',
    ...overrides,
  };
}

describe('classify', () => {
  let fertilizerExpense: Account;
  let soilTestExpense: Account;

  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
    fertilizerExpense = createAccount({
      code: '5000',
      name: 'Fertilizer Expense',
      type: 'expense',
    });
    soilTestExpense = createAccount({ code: '5002', name: 'Soil Test Expense', type: 'expense' });
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('exact mapping match: MATCHED with correct accountId and source', () => {
    createMapping('fertilizer', fertilizerExpense.id);
    const result = classify(makeTransaction({ description: 'fertilizer' }));
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe(fertilizerExpense.id);
      expect(result.matchSource).toBe('exact_mapping');
      expect(result.requiresConfirmation).toBe(false);
    }
  });

  it('keyword mapping match: MATCHED when the keyword appears as a token within a longer description', () => {
    createMapping('fertilizer', fertilizerExpense.id);
    const result = classify(makeTransaction({ description: 'urea fertilizer 50kg bag' }));
    expect(result.status).toBe('matched');
    if (result.status === 'matched') {
      expect(result.accountId).toBe(fertilizerExpense.id);
      expect(result.matchSource).toBe('keyword_mapping');
    }
  });

  it('no mapping: UNKNOWN, no account selected, and no posting side effect occurs', () => {
    const journalCountBefore = getDatabase().query('SELECT * FROM journal_entries').length;
    const result = classify(makeTransaction({ description: 'unrecognized widget xyz' }));
    expect(result.status).toBe('unknown');
    expect(result.accountId).toBeUndefined();
    expect(result.requiresConfirmation).toBe(true);
    // No journal entry was posted as a side effect of classification.
    expect(getDatabase().query('SELECT * FROM journal_entries').length).toBe(journalCountBefore);
  });

  it('missing description: INVALID rather than guessing from the party field', () => {
    const result = classify(
      makeTransaction({ description: undefined, party: 'Ramesh Fertilizer Store' }),
    );
    expect(result.status).toBe('invalid');
    expect(result.accountId).toBeUndefined();
  });

  it('token-boundary safety: keyword "oil" does not match text containing "soil"', () => {
    createMapping('oil', soilTestExpense.id); // deliberately mapped to an unrelated account
    const result = classify(makeTransaction({ description: 'soil testing service' }));
    expect(result.status).toBe('unknown');
  });

  it('ambiguous: two equally-specific keyword matches yield AMBIGUOUS with candidates, never an arbitrary pick', () => {
    const seedsExpense = createAccount({ code: '5003', name: 'Seeds Expense', type: 'expense' });
    createMapping('seed', fertilizerExpense.id);
    createMapping('treatment', seedsExpense.id);
    const result = classify(makeTransaction({ description: 'seed treatment purchase' }));
    expect(result.status).toBe('ambiguous');
    if (result.status === 'ambiguous') {
      expect(result.candidates.length).toBe(2);
      const accountIds = result.candidates.map((c) => c.accountId).sort();
      expect(accountIds).toEqual([fertilizerExpense.id, seedsExpense.id].sort());
    }
  });

  it('determinism: classifying the same transaction twice yields identical results', () => {
    createMapping('diesel', fertilizerExpense.id);
    const tx = makeTransaction({ description: 'diesel 20L' });
    const first = classify(tx);
    const second = classify(tx);
    expect(first).toEqual(second);
  });

  it('determinism: exact match result does not depend on mapping insertion order', async () => {
    // Order A: fertilizer mapping inserted first.
    createMapping('fertilizer', fertilizerExpense.id);
    createMapping('bag', soilTestExpense.id);
    const resultOrderA = classify(makeTransaction({ description: 'fertilizer' }));

    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
    fertilizerExpense = createAccount({
      code: '5000',
      name: 'Fertilizer Expense',
      type: 'expense',
    });
    soilTestExpense = createAccount({ code: '5002', name: 'Soil Test Expense', type: 'expense' });

    // Order B: same mappings, inserted in the opposite order.
    createMapping('bag', soilTestExpense.id);
    createMapping('fertilizer', fertilizerExpense.id);
    const resultOrderB = classify(makeTransaction({ description: 'fertilizer' }));

    expect(resultOrderA.status).toBe('matched');
    expect(resultOrderB.status).toBe('matched');
    if (resultOrderA.status === 'matched' && resultOrderB.status === 'matched') {
      expect(resultOrderA.accountId).toBe(resultOrderB.accountId);
    }
  });

  it('Hindi/Hinglish alias resolves to the same account as its English equivalent', () => {
    createMapping('fertilizer', fertilizerExpense.id);
    const english = classify(makeTransaction({ description: 'fertilizer' }));
    const alias = classify(makeTransaction({ description: 'khaad' }));
    expect(alias.status).toBe('matched');
    if (alias.status === 'matched' && english.status === 'matched') {
      expect(alias.accountId).toBe(english.accountId);
    }
  });
});
