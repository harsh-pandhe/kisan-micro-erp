/**
 * Types for Milestone 8 (local backup/restore). See docs/milestone-8.md for
 * the format decision and validation rules.
 */

/** Bumped whenever the backup envelope or the compatibility rule changes. */
export const BACKUP_FORMAT_VERSION = 1;

/** Written into the `settings` table of every exported database as the compatibility marker. */
export const BACKUP_FORMAT_VERSION_KEY = 'backup_format_version';

export const BACKUP_APP_ID = 'kisan-micro-erp';

/** Core tables every valid backup must contain (mirrors `src/db/schema.ts`). */
export const REQUIRED_TABLES = [
  'accounts',
  'journal_entries',
  'journal_lines',
  'transactions',
  'item_mappings',
  'settings',
] as const;

export type BackupErrorKind =
  | 'empty-file'
  | 'unreadable'
  | 'integrity-check-failed'
  | 'foreign-key-violation'
  | 'missing-tables'
  | 'unsupported-version'
  | 'export-failed'
  | 'persist-failed';

export class BackupError extends Error {
  readonly kind: BackupErrorKind;
  readonly cause?: unknown;

  constructor(kind: BackupErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'BackupError';
    this.kind = kind;
    this.cause = cause;
  }
}

export interface BackupValidationResult {
  valid: true;
  formatVersion: number;
  tableCounts: Record<string, number>;
}

/** Summary shown to the user before they confirm a restore. */
export interface BackupSummary {
  formatVersion: number;
  accounts: number;
  journalEntries: number;
  transactions: number;
  itemMappings: number;
}
