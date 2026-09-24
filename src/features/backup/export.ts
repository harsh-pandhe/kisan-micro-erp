/**
 * Milestone 8 export: serializes the current SQLite database to bytes
 * suitable for a browser download. Never mutates the live database and
 * never touches IndexedDB — see docs/milestone-8.md, "Export".
 */
import { getDatabase, loadSqlJsModule } from '../../db/database';
import { BACKUP_FORMAT_VERSION, BACKUP_FORMAT_VERSION_KEY, BackupError } from './types';

/** `kisan-micro-erp-backup-2026-09-24T101530.sqlite` — sortable, filesystem-safe. */
export function backupFileName(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '').replace('Z', '');
  return `kisan-micro-erp-backup-${stamp}.sqlite`;
}

/**
 * Produces the backup bytes: a real, standalone SQLite file (openable by
 * any SQLite tool) stamped with the `backup_format_version` marker in its
 * `settings` table.
 *
 * The stamping happens on a throwaway sql.js instance built from the
 * exported bytes, never on the live singleton, so this function cannot
 * leave a `backup_format_version` row behind in the running app's database
 * and cannot fail partway through and leave the live DB in a stamped state.
 */
export async function exportDatabase(): Promise<Uint8Array> {
  const db = getDatabase();
  let liveBytes: Uint8Array;
  try {
    liveBytes = db.export();
  } catch (cause) {
    throw new BackupError('export-failed', 'Failed to export the current database', cause);
  }

  const sqlJs = await loadSqlJsModule();
  const temp = new sqlJs.Database(liveBytes);
  try {
    temp.run(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [BACKUP_FORMAT_VERSION_KEY, String(BACKUP_FORMAT_VERSION)],
    );
    return temp.export();
  } catch (cause) {
    throw new BackupError('export-failed', 'Failed to stamp backup format version', cause);
  } finally {
    temp.close();
  }
}

/** Wraps the exported bytes as a downloadable Blob (typed for the SQLite file). */
export function exportDatabaseAsBlob(bytes: Uint8Array): Blob {
  // Copy into a plain ArrayBuffer-backed Uint8Array: sql.js's exported bytes
  // are typed with a broader ArrayBufferLike, which Blob's constructor
  // (correctly) does not accept.
  const copy = new Uint8Array(bytes);
  return new Blob([copy], { type: 'application/x-sqlite3' });
}

/**
 * Standard browser download pattern: Blob + object URL + a temporary
 * anchor with the `download` attribute. No network request is made; this
 * only triggers the browser's native save/download flow.
 */
export function downloadBackup(bytes: Uint8Array, fileName: string = backupFileName()): void {
  const blob = exportDatabaseAsBlob(bytes);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    // Revoke on a delay so the click's download can actually start in
    // every browser before the object URL is invalidated.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
