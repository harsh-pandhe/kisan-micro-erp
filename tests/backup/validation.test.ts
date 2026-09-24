import 'fake-indexeddb/auto';
import initSqlJs, { type SqlJsStatic } from 'sql.js';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { SCHEMA_SQL } from '../../src/db/schema';
import { BackupError, BACKUP_FORMAT_VERSION_KEY } from '../../src/features/backup/types';
import {
  openCandidateDatabase,
  validateCandidateDatabase,
} from '../../src/features/backup/validate';
import { validateBackup } from '../../src/features/backup/import';
import { resetDb } from './helpers';

let SQL: SqlJsStatic;

beforeAll(async () => {
  SQL = await initSqlJs({
    locateFile: (file) => `${process.cwd()}/node_modules/sql.js/dist/${file}`,
  });
});

function stampedGoodDb() {
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys = ON;');
  db.run(SCHEMA_SQL);
  db.run(`INSERT INTO settings (key, value) VALUES (?, '1')`, [BACKUP_FORMAT_VERSION_KEY]);
  return db;
}

describe('validateCandidateDatabase (direct, in-memory)', () => {
  it('accepts a well-formed, correctly stamped database', () => {
    const db = stampedGoodDb();
    db.run(`INSERT INTO accounts (code, name, type) VALUES ('1000', 'Cash', 'asset')`);
    const result = validateCandidateDatabase(db);
    db.close();
    expect(result.valid).toBe(true);
    expect(result.formatVersion).toBe(1);
    expect(result.tableCounts.accounts).toBe(1);
  });

  it('accepts an empty (no rows) but schema-complete database', () => {
    const db = stampedGoodDb();
    const result = validateCandidateDatabase(db);
    db.close();
    expect(result.valid).toBe(true);
    expect(result.tableCounts.accounts).toBe(0);
  });

  it('rejects a database missing required tables', () => {
    const db = new SQL.Database();
    db.run('CREATE TABLE settings (key TEXT PRIMARY KEY, value TEXT);');
    db.run(`INSERT INTO settings (key, value) VALUES ('${BACKUP_FORMAT_VERSION_KEY}', '1')`);
    expect(() => validateCandidateDatabase(db)).toThrow(BackupError);
    try {
      validateCandidateDatabase(db);
    } catch (err) {
      expect((err as BackupError).kind).toBe('missing-tables');
    }
    db.close();
  });

  it('rejects an unsupported (future) format version', () => {
    const db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');
    db.run(SCHEMA_SQL);
    db.run(`INSERT INTO settings (key, value) VALUES (?, '999')`, [BACKUP_FORMAT_VERSION_KEY]);
    try {
      validateCandidateDatabase(db);
      expect.fail('expected rejection');
    } catch (err) {
      expect(err).toBeInstanceOf(BackupError);
      expect((err as BackupError).kind).toBe('unsupported-version');
    }
    db.close();
  });

  it('rejects a database with no format version marker at all', () => {
    const db = new SQL.Database();
    db.run('PRAGMA foreign_keys = ON;');
    db.run(SCHEMA_SQL);
    try {
      validateCandidateDatabase(db);
      expect.fail('expected rejection');
    } catch (err) {
      expect((err as BackupError).kind).toBe('unsupported-version');
    }
    db.close();
  });

  it('rejects a database with a foreign key violation', () => {
    const db = stampedGoodDb();
    // Insert a journal line pointing at a non-existent account, bypassing
    // FK enforcement at insert time so the violation is present when
    // foreign_key_check runs (mirrors a hand-edited/corrupted backup).
    db.run('PRAGMA foreign_keys = OFF;');
    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date) VALUES ('journal', 'JV-1', '2026-01-01')`,
    );
    db.run(
      `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor) VALUES (1, 999, 'debit', 100)`,
    );
    try {
      validateCandidateDatabase(db);
      expect.fail('expected rejection');
    } catch (err) {
      expect((err as BackupError).kind).toBe('foreign-key-violation');
    }
    db.close();
  });
});

describe('openCandidateDatabase (untrusted bytes)', () => {
  it('rejects an empty file', () => {
    expect(() => openCandidateDatabase(SQL, new Uint8Array())).toThrow(BackupError);
  });

  it('rejects a random text file', () => {
    const bytes = new TextEncoder().encode('this is not a database, just plain text');
    // sql.js may open arbitrary bytes as an empty in-memory DB without
    // throwing at open time; the schema/table checks in
    // validateCandidateDatabase are what must catch it.
    expect(() => {
      const candidate = openCandidateDatabase(SQL, bytes);
      try {
        validateCandidateDatabase(candidate);
      } finally {
        candidate.close();
      }
    }).toThrow(BackupError);
  });

  it('rejects truncated/corrupted SQLite bytes', () => {
    const db = stampedGoodDb();
    const full = db.export();
    db.close();
    const truncated = full.slice(0, Math.floor(full.length / 3));
    // Either fails to open, or opens but fails integrity_check — both are
    // acceptable outcomes for corrupted bytes; either way it must throw.
    expect(() => {
      const candidate = openCandidateDatabase(SQL, truncated);
      try {
        validateCandidateDatabase(candidate);
      } finally {
        candidate.close();
      }
    }).toThrow(BackupError);
  });
});

describe('validateBackup (bytes -> temporary sql.js instance, end to end)', () => {
  beforeEach(async () => resetDb());
  afterEach(async () => resetDb());

  it('accepts good bytes and rejects bad bytes without crashing', async () => {
    const db = stampedGoodDb();
    const goodBytes = db.export();
    db.close();

    const result = await validateBackup(goodBytes);
    expect(result.valid).toBe(true);

    await expect(validateBackup(new Uint8Array([1, 2, 3]))).rejects.toThrow(BackupError);
    await expect(validateBackup(new Uint8Array())).rejects.toThrow(BackupError);
  });
});
