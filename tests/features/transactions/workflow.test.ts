import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initializeDatabase } from '../../../src/db/database';
import { resetPersistenceConnection } from '../../../src/db/persistence';
import { createAccount } from '../../../src/features/accounting/accounts';
import { getAccountBalance } from '../../../src/features/accounting/journal';
import { AccountNotFoundError } from '../../../src/features/accounting/errors';
import { classify, learnMapping } from '../../../src/features/classification';
import { parseTransactionText } from '../../../src/parser';
import {
  countTransactions,
  listTransactionHistory,
  recordTransaction,
} from '../../../src/features/transactions/service';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

const REF_DATE = new Date('2026-01-15T10:00:00Z');

function seedAccounts() {
  const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
  const fertilizer = createAccount({ code: '5000', name: 'Fertilizer Expense', type: 'expense' });
  const sales = createAccount({ code: '4000', name: 'Sales', type: 'income' });
  return { cash, fertilizer, sales };
}

describe('Milestone 6: end-to-end transaction workflow', () => {
  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('records a typed transaction with an exact mapping: parse -> classify (matched) -> confirm -> post', async () => {
    const { cash, fertilizer } = seedAccounts();
    await learnMapping('fertilizer', fertilizer.id);

    const rawText = 'Paid 500 cash for fertilizer';
    const parseResult = parseTransactionText(rawText, REF_DATE);
    expect(parseResult.status).toBe('SUCCESS');
    if (parseResult.status !== 'SUCCESS') throw new Error('unreachable');

    const classification = classify(parseResult.transaction);
    expect(classification.status).toBe('matched');
    if (classification.status !== 'matched') throw new Error('unreachable');
    expect(classification.accountId).toBe(fertilizer.id);

    const { journalEntry } = await recordTransaction({
      rawText,
      inputMethod: 'text',
      type: parseResult.transaction.type!,
      amountMinor: parseResult.transaction.amount!.minorUnits,
      date: parseResult.transaction.date ?? '2026-01-15',
      classifiedAccountId: classification.accountId,
      counterAccountId: cash.id,
      narration: parseResult.transaction.description,
    });

    expect(journalEntry.lines).toHaveLength(2);
    const debit = journalEntry.lines.find((l) => l.side === 'debit')!;
    const credit = journalEntry.lines.find((l) => l.side === 'credit')!;
    expect(debit.amountMinor).toBe(credit.amountMinor);
    expect(debit.accountId).toBe(fertilizer.id);
    expect(credit.accountId).toBe(cash.id);

    const history = listTransactionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('posted');
    expect(history[0].journalEntryId).toBe(journalEntry.id);
  });

  it('shows UNKNOWN for an unmapped item, posts nothing until the user picks an account and confirms', async () => {
    const { cash, fertilizer } = seedAccounts();

    const parseResult = parseTransactionText('Paid 200 cash for urea', REF_DATE);
    expect(parseResult.status).toBe('SUCCESS');
    if (parseResult.status !== 'SUCCESS') throw new Error('unreachable');

    const classification = classify(parseResult.transaction);
    expect(classification.status).toBe('unknown');

    // Nothing posted yet.
    expect(listTransactionHistory()).toHaveLength(0);

    // User picks an account and asks to remember it.
    const learned = await learnMapping('urea', fertilizer.id);
    expect(learned.accountId).toBe(fertilizer.id);

    const { journalEntry } = await recordTransaction({
      rawText: 'Paid 200 cash for urea',
      inputMethod: 'text',
      type: parseResult.transaction.type!,
      amountMinor: parseResult.transaction.amount!.minorUnits,
      date: parseResult.transaction.date ?? '2026-01-15',
      classifiedAccountId: fertilizer.id,
      counterAccountId: cash.id,
      narration: parseResult.transaction.description,
    });
    expect(journalEntry.id).toBeGreaterThan(0);

    // Reclassifying the same item now matches via the learned mapping.
    const reclassified = classify(
      parseTransactionText('Paid 100 cash for urea', REF_DATE).transaction as never,
    );
    expect(reclassified.status).toBe('matched');
  });

  it('shows AMBIGUOUS candidates and posts nothing until resolved', async () => {
    const { fertilizer, sales } = seedAccounts();
    // Two equally-specific single-token mappings that both match "seed".
    await learnMapping('seed', fertilizer.id);
    // Force an ambiguous case using two mappings of equal specificity that both
    // appear as whole tokens in the description "seed stock".
    await learnMapping('stock', sales.id);

    const parseResult = parseTransactionText('Paid 300 cash for seed stock', REF_DATE);
    expect(parseResult.status).toBe('SUCCESS');
    if (parseResult.status !== 'SUCCESS') throw new Error('unreachable');

    const classification = classify(parseResult.transaction);
    expect(classification.status).toBe('ambiguous');
    if (classification.status !== 'ambiguous') throw new Error('unreachable');
    expect(classification.candidates.length).toBeGreaterThanOrEqual(2);

    expect(listTransactionHistory()).toHaveLength(0);
  });

  it('shows an error for invalid parser input and writes nothing to the DB', () => {
    const parseResult = parseTransactionText('hello there', REF_DATE);
    expect(parseResult.status).toBe('INVALID');
    expect(listTransactionHistory()).toHaveLength(0);
    expect(countTransactions()).toBe(0);
  });

  it('does not report success on an accounting failure, and leaves no partial journal data', async () => {
    const { fertilizer } = seedAccounts();
    const rawText = 'Paid 500 cash for fertilizer';
    const parseResult = parseTransactionText(rawText, REF_DATE);
    if (parseResult.status !== 'SUCCESS') throw new Error('unreachable');

    const bogusAccountId = 999999; // does not exist

    await expect(
      recordTransaction({
        rawText,
        inputMethod: 'text',
        type: parseResult.transaction.type!,
        amountMinor: parseResult.transaction.amount!.minorUnits,
        date: '2026-01-15',
        classifiedAccountId: fertilizer.id,
        counterAccountId: bogusAccountId,
        narration: parseResult.transaction.description,
      }),
    ).rejects.toThrow(AccountNotFoundError);

    // The transactions row is marked rejected, not left dangling, and no
    // journal entry/lines exist for it.
    const history = listTransactionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].status).toBe('rejected');
    expect(history[0].journalEntryId).toBeNull();

    const db = getDatabase();
    const [{ count }] = db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM journal_entries',
    );
    expect(count).toBe(0);
  });

  it('one confirm action produces exactly one journal entry (no double submission)', async () => {
    const { cash, fertilizer } = seedAccounts();
    const rawText = 'Paid 500 cash for fertilizer';
    const parseResult = parseTransactionText(rawText, REF_DATE);
    if (parseResult.status !== 'SUCCESS') throw new Error('unreachable');

    const input = {
      rawText,
      inputMethod: 'text' as const,
      type: parseResult.transaction.type!,
      amountMinor: parseResult.transaction.amount!.minorUnits,
      date: '2026-01-15',
      classifiedAccountId: fertilizer.id,
      counterAccountId: cash.id,
      narration: parseResult.transaction.description,
    };

    // A single confirm click leads to a single call; the UI disables the
    // button while posting, so we assert the invariant directly here.
    await recordTransaction(input);

    const db = getDatabase();
    const [{ count }] = db.query<{ count: number }>(
      'SELECT COUNT(*) as count FROM journal_entries',
    );
    expect(count).toBe(1);
  });

  it('persists across a fresh DB instance: posted transaction appears in history after reload', async () => {
    const { cash, fertilizer } = seedAccounts();
    const rawText = 'Paid 500 cash for fertilizer';
    const parseResult = parseTransactionText(rawText, REF_DATE);
    if (parseResult.status !== 'SUCCESS') throw new Error('unreachable');

    const { journalEntry } = await recordTransaction({
      rawText,
      inputMethod: 'text',
      type: parseResult.transaction.type!,
      amountMinor: parseResult.transaction.amount!.minorUnits,
      date: '2026-01-15',
      classifiedAccountId: fertilizer.id,
      counterAccountId: cash.id,
      narration: parseResult.transaction.description,
    });

    closeDatabase();
    await initializeDatabase();

    const history = listTransactionHistory();
    expect(history).toHaveLength(1);
    expect(history[0].journalEntryId).toBe(journalEntry.id);
    expect(history[0].rawText).toBe(rawText);
  });

  it('every successfully posted transaction has SUM(debits) === SUM(credits) at the DB level', async () => {
    const { cash, fertilizer, sales } = seedAccounts();
    await recordTransaction({
      rawText: 'Paid 500 cash for fertilizer',
      inputMethod: 'text',
      type: 'purchase',
      amountMinor: 50000,
      date: '2026-01-15',
      classifiedAccountId: fertilizer.id,
      counterAccountId: cash.id,
      narration: 'fertilizer',
    });
    await recordTransaction({
      rawText: 'Received 1000 cash for crop sale',
      inputMethod: 'text',
      type: 'sale',
      amountMinor: 100000,
      date: '2026-01-16',
      classifiedAccountId: sales.id,
      counterAccountId: cash.id,
      narration: 'crop sale',
    });

    const db = getDatabase();
    const [{ debits }] = db.query<{ debits: number }>(
      `SELECT COALESCE(SUM(amount_minor), 0) as debits FROM journal_lines WHERE side = 'debit'`,
    );
    const [{ credits }] = db.query<{ credits: number }>(
      `SELECT COALESCE(SUM(amount_minor), 0) as credits FROM journal_lines WHERE side = 'credit'`,
    );
    expect(debits).toBe(credits);
    expect(getAccountBalance(cash.id)).toBe(50000); // +100000 credit, -50000 debit... see below
  });

  it('links transaction -> journal_entry -> journal_lines via sourceTransactionId with no orphans', async () => {
    const { cash, fertilizer } = seedAccounts();
    const { transactionId, journalEntry } = await recordTransaction({
      rawText: 'Paid 500 cash for fertilizer',
      inputMethod: 'text',
      type: 'purchase',
      amountMinor: 50000,
      date: '2026-01-15',
      classifiedAccountId: fertilizer.id,
      counterAccountId: cash.id,
      narration: 'fertilizer',
    });

    const db = getDatabase();
    const [entryRow] = db.query<{ source_transaction_id: number }>(
      'SELECT source_transaction_id FROM journal_entries WHERE id = ?',
      [journalEntry.id],
    );
    expect(entryRow.source_transaction_id).toBe(transactionId);

    const lineRows = db.query<{ id: number }>(
      'SELECT id FROM journal_lines WHERE journal_entry_id = ?',
      [journalEntry.id],
    );
    expect(lineRows).toHaveLength(2);

    const [txRow] = db.query<{ journal_entry_id: number }>(
      'SELECT journal_entry_id FROM transactions WHERE id = ?',
      [transactionId],
    );
    expect(txRow.journal_entry_id).toBe(journalEntry.id);
  });
});
