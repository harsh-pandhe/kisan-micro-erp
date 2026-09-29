import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Button } from './components/Button';
import { EmptyState } from './components/EmptyState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initializeDatabase } from './db/database';
import { DatabaseError } from './db/types';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { AccountsPage } from './pages/AccountsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

type DbLoadState = 'loading' | 'ready' | 'error';

/**
 * User-facing description for each known `DatabaseError` kind, so a report
 * from the field ("Database unavailable — wasm-init-failed") tells us which
 * stage actually broke without needing browser DevTools access. This does
 * not change failure behavior in any way: the app still stops before
 * touching any existing data, exactly as before.
 */
const DB_ERROR_KIND_HINT: Record<string, string> = {
  'wasm-init-failed': 'The SQLite engine (WebAssembly) could not be loaded.',
  'indexeddb-unavailable': 'The browser’s local storage (IndexedDB) is unavailable.',
  'corrupted-bytes': 'The previously saved local database could not be read.',
  'schema-init-failed': 'The database structure could not be prepared.',
  unknown: 'An unexpected error occurred while starting the local database.',
};

function describeDbError(error: unknown): string {
  if (error instanceof DatabaseError) {
    const hint = DB_ERROR_KIND_HINT[error.kind] ?? DB_ERROR_KIND_HINT.unknown;
    return `${hint} (${error.kind}: ${error.message})`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unknown error.';
}

function App() {
  const [dbState, setDbState] = useState<DbLoadState>('loading');
  const [dbErrorDetail, setDbErrorDetail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    initializeDatabase()
      .then(() => {
        if (!cancelled) setDbState('ready');
      })
      .catch((error) => {
        console.error('Database initialization failed', error);
        if (!cancelled) {
          setDbErrorDetail(describeDbError(error));
          setDbState('error');
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (dbState === 'loading') {
    return (
      <div style={{ padding: '1rem' }}>
        <EmptyState title="Loading" description="Setting up the local database…" />
      </div>
    );
  }

  if (dbState === 'error') {
    return (
      <div style={{ padding: '1rem' }}>
        <EmptyState
          title="Database unavailable"
          description={
            'The local database could not be started. Your existing data, if any, has not been touched. Try reloading the app.' +
            (dbErrorDetail ? ` Details: ${dbErrorDetail}` : '')
          }
          action={
            <Button type="button" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <HashRouter>
        <Routes>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="transactions" element={<TransactionsPage />} />
            <Route path="accounts" element={<AccountsPage />} />
            <Route path="reports" element={<ReportsPage />} />
            <Route path="settings" element={<SettingsPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Routes>
      </HashRouter>
    </ErrorBoundary>
  );
}

export default App;
