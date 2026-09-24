import { useRef, useState } from 'react';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import {
  BackupError,
  backupFileName,
  downloadBackup,
  exportDatabase,
  notifyBackupRestored,
  readBackupFile,
  restoreDatabase,
  validateBackupAndSummarize,
  type BackupSummary,
} from '../features/backup';

type RestoreState =
  | { step: 'idle' }
  | { step: 'validating'; fileName: string }
  | { step: 'ready_to_restore'; fileName: string; bytes: Uint8Array; summary: BackupSummary }
  | { step: 'restoring'; fileName: string }
  | { step: 'success'; fileName: string; summary: BackupSummary }
  | { step: 'error'; fileName: string; message: string };

function messageFor(cause: unknown): string {
  if (cause instanceof BackupError) return cause.message;
  if (cause instanceof Error) return cause.message;
  return 'Something went wrong with this backup file.';
}

/** Settings-page backup/restore controls. All logic lives in `src/features/backup`; this component only calls typed service functions. */
export function BackupRestore() {
  const [exportStatus, setExportStatus] = useState<'idle' | 'exporting' | 'success' | 'error'>(
    'idle',
  );
  const [exportError, setExportError] = useState<string | null>(null);
  const [restore, setRestore] = useState<RestoreState>({ step: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExportStatus('exporting');
    setExportError(null);
    try {
      const bytes = await exportDatabase();
      const fileName = backupFileName();
      downloadBackup(bytes, fileName);
      setExportStatus('success');
    } catch (cause) {
      setExportStatus('error');
      setExportError(messageFor(cause));
    }
  }

  async function handleFileSelected(file: File) {
    setRestore({ step: 'validating', fileName: file.name });
    try {
      const bytes = await readBackupFile(file);
      const summary = await validateBackupAndSummarize(bytes);
      setRestore({ step: 'ready_to_restore', fileName: file.name, bytes, summary });
    } catch (cause) {
      setRestore({ step: 'error', fileName: file.name, message: messageFor(cause) });
    }
  }

  async function handleConfirmRestore() {
    if (restore.step !== 'ready_to_restore') return;
    const { fileName, bytes } = restore;
    setRestore({ step: 'restoring', fileName });
    try {
      const summary = await restoreDatabase(bytes);
      notifyBackupRestored();
      setRestore({ step: 'success', fileName, summary });
    } catch (cause) {
      setRestore({ step: 'error', fileName, message: messageFor(cause) });
    }
  }

  function handleCancel() {
    setRestore({ step: 'idle' });
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const isRestoring = restore.step === 'restoring' || restore.step === 'validating';

  return (
    <div className="stack-gap">
      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleExport()}
          disabled={exportStatus === 'exporting'}
        >
          {exportStatus === 'exporting' ? 'Preparing backup…' : 'Export Backup'}
        </Button>
        {exportStatus === 'success' ? (
          <p role="status" aria-live="polite" className="card-note">
            <StatusBadge tone="positive">Downloaded</StatusBadge> Backup file download started.
          </p>
        ) : null}
        {exportStatus === 'error' ? (
          <p role="alert" className="card-note">
            <StatusBadge tone="warning">Failed</StatusBadge> {exportError}
          </p>
        ) : null}
      </div>

      <div>
        <label className="field__label" htmlFor="backup-restore-file">
          Restore from a backup file
        </label>
        <input
          id="backup-restore-file"
          ref={fileInputRef}
          type="file"
          accept=".sqlite,application/x-sqlite3"
          disabled={isRestoring || restore.step === 'ready_to_restore'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />

        {restore.step === 'validating' ? (
          <p role="status" aria-live="polite" className="card-note">
            Checking “{restore.fileName}”…
          </p>
        ) : null}

        {restore.step === 'ready_to_restore' ? (
          <div className="card-note stack-gap">
            <p role="status" aria-live="polite">
              <StatusBadge tone="warning">Ready</StatusBadge> “{restore.fileName}” is a valid backup
              (format v{restore.summary.formatVersion}): {restore.summary.accounts} account(s),{' '}
              {restore.summary.journalEntries} journal entr
              {restore.summary.journalEntries === 1 ? 'y' : 'ies'}, {restore.summary.transactions}{' '}
              transaction(s).
            </p>
            <p>
              <strong>
                You are about to replace the current local database with this backup. This cannot be
                undone.
              </strong>
            </p>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="button" variant="primary" onClick={() => void handleConfirmRestore()}>
                Restore Backup
              </Button>
            </div>
          </div>
        ) : null}

        {restore.step === 'restoring' ? (
          <p role="status" aria-live="polite" className="card-note">
            Restoring “{restore.fileName}”…
          </p>
        ) : null}

        {restore.step === 'success' ? (
          <p role="status" aria-live="polite" className="card-note">
            <StatusBadge tone="positive">Restored</StatusBadge> Database restored from “
            {restore.fileName}”. All pages now reflect the restored data.
          </p>
        ) : null}

        {restore.step === 'error' ? (
          <div className="card-note stack-gap">
            <p role="alert">
              <StatusBadge tone="warning">Rejected</StatusBadge> {restore.message}
            </p>
            <p>The current database was not changed.</p>
            <Button type="button" variant="ghost" onClick={handleCancel}>
              Dismiss
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
