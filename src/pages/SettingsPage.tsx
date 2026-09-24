import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { OfflineStatus } from '../components/OfflineStatus';
import { BackupRestore } from '../components/BackupRestore';

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="App status, data controls and information." />
      <div className="stack-gap">
        <Card title="Connectivity">
          <OfflineStatus />
          <p className="card-note">
            This app is designed to run entirely on your device. Normal use — entering and viewing
            transactions — does not require an internet connection.
          </p>
        </Card>

        <Card title="Backup & Restore">
          <p className="card-note">
            Export your entire local database to a file you control, or restore a previous backup.
            Nothing leaves this device — export and restore both work fully offline.
          </p>
          <BackupRestore />
        </Card>

        <Card title="App Information">
          <dl className="info-list">
            <div>
              <dt>App</dt>
              <dd>Kisan Micro-ERP</dd>
            </div>
            <div>
              <dt>Phase</dt>
              <dd>1 — MVP</dd>
            </div>
            <div>
              <dt>Milestone</dt>
              <dd>1 — Application shell + PWA</dd>
            </div>
          </dl>
        </Card>
      </div>
    </>
  );
}
