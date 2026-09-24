import { useEffect, useState } from 'react';
import { HashRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Button } from './components/Button';
import { EmptyState } from './components/EmptyState';
import { ErrorBoundary } from './components/ErrorBoundary';
import { initializeDatabase } from './db/database';
import { DashboardPage } from './pages/DashboardPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { AccountsPage } from './pages/AccountsPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { NotFoundPage } from './pages/NotFoundPage';

type DbLoadState = 'loading' | 'ready' | 'error';

function App() {
  const [dbState, setDbState] = useState<DbLoadState>('loading');

  useEffect(() => {
    let cancelled = false;
    initializeDatabase()
      .then(() => {
        if (!cancelled) setDbState('ready');
      })
      .catch((error) => {
        console.error('Database initialization failed', error);
        if (!cancelled) setDbState('error');
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
          description="The local database could not be started. Your existing data, if any, has not been touched. Try reloading the app."
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
