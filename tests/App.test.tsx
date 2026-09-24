import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';

describe('App shell', () => {
  it('renders the header, brand and the default dashboard page', async () => {
    render(<App />);
    expect(await screen.findByText('Kisan Micro-ERP')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Dashboard', level: 1 })).toBeInTheDocument();
  });

  it('renders the main navigation with links to every route', async () => {
    render(<App />);
    expect(await screen.findByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    for (const label of ['Dashboard', 'Transactions', 'Accounts', 'Reports', 'Settings']) {
      expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
    }
  });
});
