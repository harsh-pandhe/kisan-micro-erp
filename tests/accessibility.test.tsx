import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TransactionsPage } from '../src/pages/TransactionsPage';
import { SettingsPage } from '../src/pages/SettingsPage';

describe('accessible controls', () => {
  it('gives the disabled "Add Transaction" button an accessible name', () => {
    render(<TransactionsPage />);
    expect(screen.getByRole('button', { name: 'Add a new transaction' })).toBeInTheDocument();
  });

  it('gives the disabled "Backup data" button an accessible name', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('button', { name: 'Backup data (not yet available)' }),
    ).toBeInTheDocument();
  });
});
