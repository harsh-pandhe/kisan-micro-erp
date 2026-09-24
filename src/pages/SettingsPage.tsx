import { PageHeader } from '../components/PageHeader';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { OfflineStatus } from '../components/OfflineStatus';

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
            Export and import of your local database will be added in a later milestone. Nothing
            leaves this device today.
          </p>
          <Button
            type="button"
            variant="secondary"
            aria-label="Backup data (not yet available)"
            disabled
          >
            Backup data
          </Button>
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
