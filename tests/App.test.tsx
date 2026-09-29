import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../src/App';
import * as databaseModule from '../src/db/database';
import { DatabaseError } from '../src/db/types';

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

describe('App shell database failure handling', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('surfaces the DatabaseError kind so a field report identifies which init stage failed', async () => {
    vi.spyOn(databaseModule, 'initializeDatabase').mockRejectedValueOnce(
      new DatabaseError('wasm-init-failed', 'Failed to initialize sql.js WebAssembly module'),
    );

    render(<App />);

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    // The kind and underlying message must be visible without DevTools access,
    // since production failures are only logged to the console (see App.tsx).
    expect(screen.getByText(/wasm-init-failed/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to initialize sql\.js WebAssembly module/)).toBeInTheDocument();
    // The safety guarantee wording must remain intact — this is a diagnostic
    // addition, not a weakening of the existing failure message.
    expect(screen.getByText(/has not been touched/)).toBeInTheDocument();
  });

  it('surfaces a generic error message for a non-DatabaseError failure', async () => {
    vi.spyOn(databaseModule, 'initializeDatabase').mockRejectedValueOnce(new Error('boom'));

    render(<App />);

    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.getByText(/boom/)).toBeInTheDocument();
  });
});
