import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initializeDatabase } from '../../src/db/database';
import { loadPersistedBytes } from '../../src/db/persistence';
import { createAccount, listAccounts, postPurchase } from '../../src/features/accounting';
import { exportDatabase } from '../../src/features/backup/export';
import { restoreDatabase } from '../../src/features/backup/import';
import { BackupError } from '../../src/features/backup/types';
import { resetDb } from './helpers';

describe('rollback safety: a rejected restore leaves the active DB and IndexedDB untouched', () => {
  beforeEach(async () => {
    await resetDb();
    await initializeDatabase();
  });
  afterEach(resetDb);

  it('keeps transaction A intact after attempting to restore a corrupted backup', async () => {
    const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const feed = createAccount({ code: '5000', name: 'Feed Expense', type: 'expense' });
    const posted = await postPurchase({
      date: '2026-01-01',
      amountMinor: 10000,
      narration: 'Transaction A',
      expenseOrItemAccountId: feed.id,
      cashOrCreditorAccountId: cash.id,
    });

    const activeDbBefore = getDatabase();
    const bytesBefore = activeDbBefore.export();
    // postPurchase() already persisted via persistDatabase() internally.
    const persistedBefore = await loadPersistedBytes();
    expect(persistedBefore).not.toBeNull();

    const corrupted = new Uint8Array([0x53, 0x51, 0x4c, 0x69, 0x74, 0x01, 0x02, 0x03]);
    await expect(restoreDatabase(corrupted)).rejects.toThrow(BackupError);

    // Same singleton instance — never swapped.
    expect(getDatabase()).toBe(activeDbBefore);

    // Transaction A's journal entry is still there.
    const entry = getDatabase().query('SELECT * FROM journal_entries WHERE id = ?', [posted.id]);
    expect(entry).toHaveLength(1);
    expect(listAccounts()).toHaveLength(2);

    // The in-memory bytes are byte-for-byte unchanged.
    expect(getDatabase().export()).toEqual(bytesBefore);

    // IndexedDB bytes are unchanged (restore never got far enough to
    // persist).
    const persistedAfter = await loadPersistedBytes();
    expect(persistedAfter).toEqual(persistedBefore);
  });

  it('leaves previously-persisted IndexedDB bytes untouched by a failed restore', async () => {
    const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const feed = createAccount({ code: '5000', name: 'Feed Expense', type: 'expense' });
    await postPurchase({
      date: '2026-01-01',
      amountMinor: 12345,
      narration: 'Transaction A',
      expenseOrItemAccountId: feed.id,
      cashOrCreditorAccountId: cash.id,
    });
    // postPurchase already persisted via persistDatabase() internally.

    const persistedBefore = await loadPersistedBytes();
    expect(persistedBefore).not.toBeNull();

    // Backup with a future, unsupported format version.
    const badBackup = await exportDatabase();
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs({
      locateFile: (file: string) => `${process.cwd()}/node_modules/sql.js/dist/${file}`,
    });
    const tmp = new SQL.Database(badBackup);
    tmp.run(`UPDATE settings SET value = '999' WHERE key = 'backup_format_version'`);
    const futureVersionBytes = tmp.export();
    tmp.close();

    await expect(restoreDatabase(futureVersionBytes)).rejects.toThrow(BackupError);

    // Fresh instance restored straight from IndexedDB still has Transaction A.
    closeDatabase();
    const restored = await initializeDatabase();
    const rows = restored.query<{ narration: string }>(
      "SELECT narration FROM journal_entries WHERE narration = 'Transaction A'",
    );
    expect(rows).toHaveLength(1);

    const persistedAfter = await loadPersistedBytes();
    expect(persistedAfter).toEqual(persistedBefore);
  });
});
