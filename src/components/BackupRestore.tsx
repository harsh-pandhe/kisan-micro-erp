import { useRef, useState } from 'react';
import { Button } from './Button';
import { StatusBadge } from './StatusBadge';
import {
  BackupError,
  backupFileName,
  downloadBackup,
  downloadSignedDatabaseBackup,
  exportDatabase,
  exportSignedDatabase,
  looksLikeSignedEnvelope,
  notifyBackupRestored,
  readBackupFile,
  restoreDatabase,
  restoreSignedDatabase,
  validateBackupAndSummarize,
  validateSignedBackupAndSummarize,
  type BackupSummary,
} from '../features/backup';

interface SignedInfo {
  keyFingerprint: string;
  createdAt: string;
}

type RestoreState =
  | { step: 'idle' }
  | { step: 'validating'; fileName: string; signed: boolean }
  | {
      step: 'ready_to_restore';
      fileName: string;
      bytes: Uint8Array;
      summary: BackupSummary;
      signed: boolean;
      signedInfo?: SignedInfo;
    }
  | { step: 'restoring'; fileName: string; signed: boolean }
  | { step: 'success'; fileName: string; summary: BackupSummary; signed: boolean }
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
  const [signedExportStatus, setSignedExportStatus] = useState<
    'idle' | 'exporting' | 'success' | 'error'
  >('idle');
  const [signedExportError, setSignedExportError] = useState<string | null>(null);
  const [signedExportInfo, setSignedExportInfo] = useState<SignedInfo | null>(null);
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

  async function handleSignedExport() {
    setSignedExportStatus('exporting');
    setSignedExportError(null);
    try {
      const result = await exportSignedDatabase();
      downloadSignedDatabaseBackup(result);
      setSignedExportInfo({
        keyFingerprint: result.keyFingerprint,
        createdAt: new Date().toISOString(),
      });
      setSignedExportStatus('success');
    } catch (cause) {
      setSignedExportStatus('error');
      setSignedExportError(messageFor(cause));
    }
  }

  async function handleFileSelected(file: File) {
    let bytes: Uint8Array;
    try {
      bytes = await readBackupFile(file);
    } catch (cause) {
      setRestore({ step: 'error', fileName: file.name, message: messageFor(cause) });
      return;
    }
    const signed = looksLikeSignedEnvelope(bytes);
    setRestore({ step: 'validating', fileName: file.name, signed });
    try {
      if (signed) {
        const { summary, keyFingerprint, createdAt } =
          await validateSignedBackupAndSummarize(bytes);
        setRestore({
          step: 'ready_to_restore',
          fileName: file.name,
          bytes,
          summary,
          signed: true,
          signedInfo: { keyFingerprint, createdAt },
        });
      } else {
        const summary = await validateBackupAndSummarize(bytes);
        setRestore({
          step: 'ready_to_restore',
          fileName: file.name,
          bytes,
          summary,
          signed: false,
        });
      }
    } catch (cause) {
      setRestore({ step: 'error', fileName: file.name, message: messageFor(cause) });
    }
  }

  async function handleConfirmRestore() {
    if (restore.step !== 'ready_to_restore') return;
    const { fileName, bytes, signed } = restore;
    setRestore({ step: 'restoring', fileName, signed });
    try {
      const summary = signed
        ? (await restoreSignedDatabase(bytes)).summary
        : await restoreDatabase(bytes);
      notifyBackupRestored();
      setRestore({ step: 'success', fileName, summary, signed });
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
        <p className="card-note">
          Unsigned backup: a plain SQLite file. Integrity can be checked on restore, but it carries
          no proof of who created it or that it wasn't modified afterwards.
        </p>
      </div>

      <div>
        <Button
          type="button"
          variant="secondary"
          onClick={() => void handleSignedExport()}
          disabled={signedExportStatus === 'exporting'}
        >
          {signedExportStatus === 'exporting' ? 'Signing backup…' : 'Export Signed Backup'}
        </Button>
        {signedExportStatus === 'success' && signedExportInfo ? (
          <p role="status" aria-live="polite" className="card-note">
            <StatusBadge tone="positive">Downloaded</StatusBadge> Signed backup download started
            (signing key fingerprint {signedExportInfo.keyFingerprint}).
          </p>
        ) : null}
        {signedExportStatus === 'error' ? (
          <p role="alert" className="card-note">
            <StatusBadge tone="warning">Failed</StatusBadge> {signedExportError}
          </p>
        ) : null}
        <p className="card-note">
          Signed backup: the same SQLite data, plus a local SHA-256 hash and Ed25519 signature from
          a key generated and kept on this device. Restoring it proves the file matches what was
          signed and wasn't altered — it does not encrypt the data, which remains fully readable
          SQLite.
        </p>
      </div>

      <div>
        <label className="field__label" htmlFor="backup-restore-file">
          Restore from a backup file
        </label>
        <input
          id="backup-restore-file"
          ref={fileInputRef}
          type="file"
          accept=".sqlite,application/x-sqlite3,.kmesig"
          disabled={isRestoring || restore.step === 'ready_to_restore'}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFileSelected(file);
          }}
        />

        {restore.step === 'validating' ? (
          <p role="status" aria-live="polite" className="card-note">
            {restore.signed ? 'Verifying signed backup…' : 'Checking'} “{restore.fileName}”…
          </p>
        ) : null}

        {restore.step === 'ready_to_restore' ? (
          <div className="card-note stack-gap">
            <p role="status" aria-live="polite">
              {restore.signed ? (
                <>
                  <StatusBadge tone="positive">Signature verified</StatusBadge> “{restore.fileName}”
                  is a valid signed backup (signing key fingerprint{' '}
                  {restore.signedInfo?.keyFingerprint}, signed at {restore.signedInfo?.createdAt}).
                </>
              ) : (
                <>
                  <StatusBadge tone="warning">Unsigned</StatusBadge> “{restore.fileName}” is a valid
                  backup, but has no signature — its authenticity can't be verified, only its SQLite
                  integrity.
                </>
              )}{' '}
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
            {restore.fileName}”{restore.signed ? ' (signature verified)' : ' (unsigned)'}. All pages
            now reflect the restored data.
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
