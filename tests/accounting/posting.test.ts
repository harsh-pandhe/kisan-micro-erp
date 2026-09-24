import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initializeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';
import { createAccount } from '../../src/features/accounting/accounts';
import {
  AccountNotFoundError,
  DuplicateVoucherError,
  UnbalancedEntryError,
  ValidationError,
} from '../../src/features/accounting/errors';
import {
  getJournalEntry,
  getJournalLines,
  listJournalEntries,
} from '../../src/features/accounting/journal';
import { postJournalEntry } from '../../src/features/accounting/posting';
import type { Account } from '../../src/features/accounting/types';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('postJournalEntry', () => {
  let cash: Account;
  let sales: Account;

  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
    cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    sales = createAccount({ code: '4000', name: 'Sales', type: 'income' });
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('posts a balanced debit 100 / credit 100 entry', async () => {
    const posted = await postJournalEntry({
      voucherType: 'sale',
      date: '2026-01-01',
      narration: 'cash sale',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 100 },
        { accountId: sales.id, side: 'credit', amountMinor: 100 },
      ],
    });

    expect(posted.id).toBeGreaterThan(0);
    expect(posted.voucherNumber).toMatch(/^SAL-20260101-\d{4}$/);
    expect(posted.lines).toHaveLength(2);

    const reread = getJournalEntry(posted.id);
    expect(reread).not.toBeNull();
    expect(
      reread!.lines.map((l) => ({
        accountId: l.accountId,
        side: l.side,
        amountMinor: l.amountMinor,
      })),
    ).toEqual(
      expect.arrayContaining([
        { accountId: cash.id, side: 'debit', amountMinor: 100 },
        { accountId: sales.id, side: 'credit', amountMinor: 100 },
      ]),
    );

    const debits = reread!.lines
      .filter((l) => l.side === 'debit')
      .reduce((s, l) => s + l.amountMinor, 0);
    const credits = reread!.lines
      .filter((l) => l.side === 'credit')
      .reduce((s, l) => s + l.amountMinor, 0);
    expect(debits).toBe(credits);
  });

  it('rejects an unbalanced entry before touching the database', async () => {
    await expect(
      postJournalEntry({
        voucherType: 'journal',
        date: '2026-01-02',
        lines: [
          { accountId: cash.id, side: 'debit', amountMinor: 100 },
          { accountId: sales.id, side: 'credit', amountMinor: 90 },
        ],
      }),
    ).rejects.toThrow(UnbalancedEntryError);
    expect(listJournalEntries()).toHaveLength(0);
  });

  it('rejects a single-line entry', async () => {
    await expect(
      postJournalEntry({
        voucherType: 'journal',
        date: '2026-01-02',
        lines: [{ accountId: cash.id, side: 'debit', amountMinor: 100 }],
      }),
    ).rejects.toThrow(ValidationError);
  });

  it('rejects and rolls back when a line references a nonexistent account', async () => {
    await expect(
      postJournalEntry({
        voucherType: 'journal',
        date: '2026-01-02',
        lines: [
          { accountId: cash.id, side: 'debit', amountMinor: 100 },
          { accountId: 999999, side: 'credit', amountMinor: 100 },
        ],
      }),
    ).rejects.toThrow(AccountNotFoundError);

    // No partial data: neither the entry nor any line should exist.
    expect(listJournalEntries()).toHaveLength(0);
    const db = getDatabase();
    expect(db.query('SELECT * FROM journal_lines')).toHaveLength(0);
  });

  it('never auto-creates a missing account', async () => {
    const accountsBefore = getDatabase().query('SELECT * FROM accounts').length;
    await expect(
      postJournalEntry({
        voucherType: 'journal',
        date: '2026-01-02',
        lines: [
          { accountId: cash.id, side: 'debit', amountMinor: 100 },
          { accountId: 424242, side: 'credit', amountMinor: 100 },
        ],
      }),
    ).rejects.toThrow(AccountNotFoundError);
    expect(getDatabase().query('SELECT * FROM accounts').length).toBe(accountsBefore);
  });

  it('rejects a duplicate voucher number and leaves the first posting intact', async () => {
    const first = await postJournalEntry({
      voucherType: 'journal',
      voucherNumber: 'JV-DUP-1',
      date: '2026-01-03',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 100 },
        { accountId: sales.id, side: 'credit', amountMinor: 100 },
      ],
    });

    await expect(
      postJournalEntry({
        voucherType: 'journal',
        voucherNumber: 'JV-DUP-1',
        date: '2026-01-04',
        lines: [
          { accountId: cash.id, side: 'debit', amountMinor: 50 },
          { accountId: sales.id, side: 'credit', amountMinor: 50 },
        ],
      }),
    ).rejects.toThrow(DuplicateVoucherError);

    expect(listJournalEntries()).toHaveLength(1);
    const reread = getJournalEntry(first.id);
    expect(reread?.voucherNumber).toBe('JV-DUP-1');
    expect(getJournalLines(first.id)).toHaveLength(2);
  });

  it('generates sequential voucher numbers per type/date when none is supplied', async () => {
    const a = await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-05',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 10 },
        { accountId: sales.id, side: 'credit', amountMinor: 10 },
      ],
    });
    const b = await postJournalEntry({
      voucherType: 'journal',
      date: '2026-01-05',
      lines: [
        { accountId: cash.id, side: 'debit', amountMinor: 10 },
        { accountId: sales.id, side: 'credit', amountMinor: 10 },
      ],
    });
    expect(a.voucherNumber).not.toBe(b.voucherNumber);
  });
});
