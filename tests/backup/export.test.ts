import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDatabase, initializeDatabase } from '../../src/db/database';
import { createAccount } from '../../src/features/accounting';
import { exportDatabase } from '../../src/features/backup/export';
import { resetDb } from './helpers';

describe('exportDatabase', () => {
  beforeEach(async () => {
    await resetDb();
    await initializeDatabase();
  });
  afterEach(resetDb);

  it('produces non-empty bytes for a fresh (empty) database', async () => {
    const bytes = await exportDatabase();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });

  it('does not mutate the live database', async () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const before = getDatabase().export();

    await exportDatabase();

    const after = getDatabase().export();
    expect(after).toEqual(before);
  });

  it('does not write to IndexedDB', async () => {
    const { loadPersistedBytes } = await import('../../src/db/persistence');
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    await exportDatabase();
    const persisted = await loadPersistedBytes();
    expect(persisted).toBeNull();
  });

  it('stamps the backup with a readable format version marker without touching the live settings table', async () => {
    const bytes = await exportDatabase();
    const initSqlJs = (await import('sql.js')).default;
    const SQL = await initSqlJs({
      locateFile: (file: string) => `${process.cwd()}/node_modules/sql.js/dist/${file}`,
    });
    const readBack = new SQL.Database(bytes);
    const rows = readBack.exec("SELECT value FROM settings WHERE key = 'backup_format_version'");
    readBack.close();
    expect(rows[0].values[0][0]).toBe('1');

    // Live DB's settings table was never stamped.
    const liveSettings = getDatabase().query('SELECT * FROM settings');
    expect(liveSettings).toEqual([]);
  });
});
