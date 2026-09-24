export * from './types';
export { exportDatabase, exportDatabaseAsBlob, downloadBackup, backupFileName } from './export';
export {
  readBackupFile,
  validateBackup,
  validateBackupAndSummarize,
  restoreDatabase,
} from './import';
export const BACKUP_RESTORED_EVENT = 'kisan:backup-restored';

/** Notifies the rest of the app that the active database was just replaced by a restore, so pages holding cached data know to re-fetch. */
export function notifyBackupRestored(): void {
  window.dispatchEvent(new CustomEvent(BACKUP_RESTORED_EVENT));
}
