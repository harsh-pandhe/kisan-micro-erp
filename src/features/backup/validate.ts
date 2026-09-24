/**
 * Untrusted-input validation for a backup file's bytes. Never touches the
 * live singleton database — always operates on a throwaway sql.js
 * `Database` built from the candidate bytes. See docs/milestone-8.md,
 * "Validation".
 */
import type { Database as SqlJsDatabase, SqlJsStatic } from 'sql.js';
import {
  BACKUP_FORMAT_VERSION,
  BACKUP_FORMAT_VERSION_KEY,
  BackupError,
  REQUIRED_TABLES,
  type BackupSummary,
  type BackupValidationResult,
} from './types';

/** Opens the candidate bytes as an isolated sql.js Database. Throws BackupError on any failure to open. */
export function openCandidateDatabase(sqlJs: SqlJsStatic, bytes: Uint8Array): SqlJsDatabase {
  if (!bytes || bytes.length === 0) {
    throw new BackupError('empty-file', 'The selected file is empty');
  }
  try {
    return new sqlJs.Database(bytes);
  } catch (cause) {
    throw new BackupError(
      'unreadable',
      'The selected file is not a readable SQLite database',
      cause,
    );
  }
}

function tableExists(db: SqlJsDatabase, table: string): boolean {
  const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name = ?", [table]);
  return result.length > 0 && result[0].values.length > 0;
}

/**
 * Runs every check required before a backup may ever be considered for
 * restore: openability, `PRAGMA integrity_check`, `PRAGMA
 * foreign_key_check`, presence of every core table, and a supported
 * `backup_format_version` marker in `settings`. Throws a typed
 * `BackupError` on the first failure — never attempts to repair or
 * auto-migrate.
 */
export function validateCandidateDatabase(db: SqlJsDatabase): BackupValidationResult {
  // 1. Integrity check.
  let integrityRows: unknown[][];
  try {
    integrityRows = db.exec('PRAGMA integrity_check;')[0]?.values ?? [];
  } catch (cause) {
    throw new BackupError('integrity-check-failed', 'PRAGMA integrity_check could not run', cause);
  }
  const integrityResult = String(integrityRows[0]?.[0] ?? '');
  if (integrityResult.toLowerCase() !== 'ok') {
    throw new BackupError(
      'integrity-check-failed',
      `SQLite integrity check failed: ${integrityResult || 'unknown error'}`,
    );
  }

  // 2. Foreign key check — must return zero rows (no violations).
  let fkRows: unknown[][];
  try {
    fkRows = db.exec('PRAGMA foreign_key_check;')[0]?.values ?? [];
  } catch (cause) {
    throw new BackupError('foreign-key-violation', 'PRAGMA foreign_key_check could not run', cause);
  }
  if (fkRows.length > 0) {
    throw new BackupError(
      'foreign-key-violation',
      `Backup contains ${fkRows.length} foreign key violation(s)`,
    );
  }

  // 3. Every core table must exist.
  const missing = REQUIRED_TABLES.filter((table) => !tableExists(db, table));
  if (missing.length > 0) {
    throw new BackupError(
      'missing-tables',
      `Backup is missing required table(s): ${missing.join(', ')}`,
    );
  }

  // 4. Format version marker must exist and be a version we support.
  let versionRows: unknown[][];
  try {
    versionRows =
      db.exec('SELECT value FROM settings WHERE key = ?', [BACKUP_FORMAT_VERSION_KEY])[0]?.values ??
      [];
  } catch (cause) {
    throw new BackupError('unsupported-version', 'Could not read backup format version', cause);
  }
  const rawVersion = versionRows[0]?.[0];
  const formatVersion = rawVersion === undefined ? NaN : Number(rawVersion);
  if (!Number.isInteger(formatVersion)) {
    throw new BackupError(
      'unsupported-version',
      'Backup is missing a recognizable format version marker',
    );
  }
  if (formatVersion > BACKUP_FORMAT_VERSION) {
    throw new BackupError(
      'unsupported-version',
      `Backup format version ${formatVersion} is newer than this app supports (${BACKUP_FORMAT_VERSION})`,
    );
  }
  if (formatVersion < 1) {
    throw new BackupError(
      'unsupported-version',
      `Backup format version ${formatVersion} is not recognized`,
    );
  }

  const tableCounts: Record<string, number> = {};
  for (const table of REQUIRED_TABLES) {
    const rows = db.exec(`SELECT COUNT(*) FROM ${table}`)[0]?.values ?? [];
    tableCounts[table] = Number(rows[0]?.[0] ?? 0);
  }

  return { valid: true, formatVersion, tableCounts };
}

/** Builds the human-readable summary shown before the user confirms a restore. */
export function summarize(result: BackupValidationResult): BackupSummary {
  return {
    formatVersion: result.formatVersion,
    accounts: result.tableCounts.accounts ?? 0,
    journalEntries: result.tableCounts.journal_entries ?? 0,
    transactions: result.tableCounts.transactions ?? 0,
    itemMappings: result.tableCounts.item_mappings ?? 0,
  };
}
