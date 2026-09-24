import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TransactionsPage } from '../src/pages/TransactionsPage';
import { SettingsPage } from '../src/pages/SettingsPage';

describe('accessible controls', () => {
  it('gives the Transactions page controls accessible names', () => {
    render(<TransactionsPage />);
    expect(screen.getByRole('button', { name: 'Parse' })).toBeInTheDocument();
    expect(screen.getByLabelText('Describe the transaction')).toBeInTheDocument();
  });

  it('gives the "Export Backup" button an accessible name', () => {
    render(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: 'Export Backup' })).toBeInTheDocument();
  });
});
