/**
 * Milestone 8 import/restore: treats the selected file as fully untrusted.
 * `validateBackup` never touches the active database. `restoreDatabase`
 * only swaps the active singleton after every check in `validate.ts` has
 * passed — see docs/milestone-8.md, "Atomic restore".
 */
import { loadSqlJsModule, persistDatabase, replaceDatabase } from '../../db/database';
import { verifySignedBackup } from '../crypto';
import { openCandidateDatabase, summarize, validateCandidateDatabase } from './validate';
import { BackupError, type BackupSummary, type BackupValidationResult } from './types';

/** Reads a browser `File` into raw bytes. Pure file-API usage — no network. */
export async function readBackupFile(file: File): Promise<Uint8Array> {
  const buffer = await file.arrayBuffer();
  return new Uint8Array(buffer);
}

/**
 * Opens the candidate bytes in a temporary, unattached sql.js instance and
 * runs every validation check, then discards the temporary instance. The
 * active database is never referenced here, so a failed validation leaves
 * it — and its IndexedDB persistence — completely untouched.
 */
export async function validateBackup(bytes: Uint8Array): Promise<BackupValidationResult> {
  const sqlJs = await loadSqlJsModule();
  const temp = openCandidateDatabase(sqlJs, bytes);
  try {
    return validateCandidateDatabase(temp);
  } finally {
    temp.close();
  }
}

/** Convenience: validate and return the user-facing summary in one call. */
export async function validateBackupAndSummarize(bytes: Uint8Array): Promise<BackupSummary> {
  const result = await validateBackup(bytes);
  return summarize(result);
}

/**
 * Restores `bytes` as the app's active database. Re-validates from scratch
 * (never trusts a caller's earlier `validateBackup` result, in case the
 * bytes changed in between) by opening a fresh temporary instance; only
 * once that passes does it hand the temporary instance's connection to
 * `replaceDatabase`, which swaps the singleton, and then calls
 * `persistDatabase()` to write the new state to IndexedDB.
 *
 * If validation fails, the temporary instance is closed and discarded and
 * this function throws — the active database and its IndexedDB bytes are
 * never touched. If the swap itself succeeds but `persistDatabase()`
 * fails (e.g. IndexedDB unavailable), the in-memory app state is already
 * the restored one but the write to IndexedDB did not happen; the thrown
 * `BackupError` (kind `persist-failed`) tells the caller to retry
 * persisting rather than silently losing the restore.
 */
export async function restoreDatabase(bytes: Uint8Array): Promise<BackupSummary> {
  const sqlJs = await loadSqlJsModule();
  const temp = openCandidateDatabase(sqlJs, bytes);

  let result;
  try {
    result = validateCandidateDatabase(temp);
  } catch (err) {
    temp.close();
    throw err;
  }

  // All validation passed — now, and only now, replace the active DB.
  replaceDatabase(temp);

  try {
    await persistDatabase();
  } catch (cause) {
    throw new BackupError(
      'persist-failed',
      'Backup was restored into the running app but could not be saved to IndexedDB',
      cause,
    );
  }

  return summarize(result);
}

/**
 * Milestone 9: verifies a signed `.kmesig` file's crypto envelope and,
 * if that passes, runs M8's SQLite validation against the extracted
 * bytes — without restoring anything. Used to preview a signed backup
 * before the user confirms the restore.
 */
export async function validateSignedBackupAndSummarize(fileBytes: Uint8Array): Promise<{
  summary: BackupSummary;
  keyFingerprint: string;
  createdAt: string;
}> {
  const verification = verifySignedBackup(fileBytes);
  if (verification.status !== 'VALID') {
    throw new BackupError('signature-invalid', signedVerificationMessage(verification));
  }
  const summary = await validateBackupAndSummarize(verification.sqliteBytes);
  return {
    summary,
    keyFingerprint: verification.keyFingerprint,
    createdAt: verification.createdAt,
  };
}

/**
 * Milestone 9: restores from a signed `.kmesig` backup. Trust order
 * (see docs/milestone-9.md, "Restore verification order"):
 *
 *   file bytes -> envelope parse -> crypto verification (hash + Ed25519
 *   signature) -> SQLite open in an isolated instance -> M8's
 *   `validateCandidateDatabase` (integrity_check, foreign_key_check,
 *   schema/version) -> only then `replaceDatabase()` + `persistDatabase()`.
 *
 * A failed crypto verification throws before any SQLite instance is even
 * opened, so the active database and its IndexedDB persistence are left
 * completely untouched — same guarantee M8 gives for a failed SQLite
 * validation.
 */
export async function restoreSignedDatabase(
  fileBytes: Uint8Array,
): Promise<{ summary: BackupSummary; keyFingerprint: string; createdAt: string }> {
  const verification = verifySignedBackup(fileBytes);
  if (verification.status !== 'VALID') {
    throw new BackupError('signature-invalid', signedVerificationMessage(verification));
  }

  const summary = await restoreDatabase(verification.sqliteBytes);
  return {
    summary,
    keyFingerprint: verification.keyFingerprint,
    createdAt: verification.createdAt,
  };
}

function signedVerificationMessage(
  verification: Exclude<ReturnType<typeof verifySignedBackup>, { status: 'VALID' }>,
): string {
  switch (verification.status) {
    case 'INVALID_HASH':
      return `Signed backup failed hash verification: ${verification.message}`;
    case 'INVALID_SIGNATURE':
      return `Signed backup failed signature verification: ${verification.message}`;
    case 'INVALID_FORMAT':
      return `Signed backup has an invalid format: ${verification.message}`;
    case 'UNSUPPORTED_VERSION':
      return `Signed backup format is not supported: ${verification.message}`;
    case 'MALFORMED_BACKUP':
      return `Signed backup file is malformed: ${verification.message}`;
  }
}
