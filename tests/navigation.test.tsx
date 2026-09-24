import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppShell } from '../src/components/AppShell';
import { DashboardPage } from '../src/pages/DashboardPage';
import { TransactionsPage } from '../src/pages/TransactionsPage';
import { AccountsPage } from '../src/pages/AccountsPage';
import { ReportsPage } from '../src/pages/ReportsPage';
import { SettingsPage } from '../src/pages/SettingsPage';
import { NotFoundPage } from '../src/pages/NotFoundPage';

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
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
    </MemoryRouter>,
  );
}

describe('routing', () => {
  it.each([
    ['/', 'Dashboard'],
    ['/transactions', 'Transactions'],
    ['/accounts', 'Accounts'],
    ['/reports', 'Reports'],
    ['/settings', 'Settings'],
  ])('renders the %s page heading for %s', (path, heading) => {
    renderAt(path);
    expect(screen.getByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  });

  it('shows a not-found page for unknown routes', () => {
    renderAt('/does-not-exist');
    expect(screen.getByRole('heading', { level: 1, name: 'Page not found' })).toBeInTheDocument();
  });

  it('navigates between pages when a bottom nav link is clicked', async () => {
    const user = userEvent.setup();
    renderAt('/');
    await user.click(screen.getByRole('link', { name: 'Accounts' }));
    expect(screen.getByRole('heading', { level: 1, name: 'Accounts' })).toBeInTheDocument();
  });
});
