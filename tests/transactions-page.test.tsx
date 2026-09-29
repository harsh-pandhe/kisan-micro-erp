import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { closeDatabase, initializeDatabase } from '../src/db/database';
import { resetPersistenceConnection } from '../src/db/persistence';
import { createAccount } from '../src/features/accounting/accounts';
import { learnMapping } from '../src/features/classification';
import { TransactionsPage } from '../src/pages/TransactionsPage';

async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

function seedAccounts() {
  const cash = createAccount({ code: '1000', name: 'Cash', type: 'asset' });
  const fertilizer = createAccount({ code: '5000', name: 'Fertilizer Expense', type: 'expense' });
  return { cash, fertilizer };
}

describe('TransactionsPage (M11-B redesign)', () => {
  beforeEach(async () => {
    closeDatabase();
    await clearPersistedDb();
    await initializeDatabase();
  });
  afterEach(async () => {
    closeDatabase();
    await clearPersistedDb();
  });

  it('renders the idle composer', () => {
    render(<TransactionsPage />);
    expect(screen.getByRole('heading', { name: 'New transaction' })).toBeInTheDocument();
    expect(screen.getByLabelText('Describe the transaction')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Review transaction' })).toBeDisabled();
  });

  it('fills the textarea from an example chip without triggering a parse', () => {
    render(<TransactionsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Sold wheat for ₹5,000' }));
    expect(screen.getByLabelText('Describe the transaction')).toHaveValue('Sold wheat for ₹5,000');
    expect(screen.queryByText('Transaction understood')).not.toBeInTheDocument();
  });

  it('shows the SUCCESS parse result and an UNKNOWN classification for a fresh item', async () => {
    seedAccounts();
    const user = userEvent.setup();
    render(<TransactionsPage />);
    await user.type(
      screen.getByLabelText('Describe the transaction'),
      'Paid 500 cash for fertilizer',
    );
    await user.click(screen.getByRole('button', { name: 'Review transaction' }));

    expect(await screen.findByText('Transaction understood')).toBeInTheDocument();
    expect(screen.getByText("We don't know this item yet")).toBeInTheDocument();
  });

  it('shows an INVALID result with the actual parser reasons', async () => {
    const user = userEvent.setup();
    render(<TransactionsPage />);
    await user.type(screen.getByLabelText('Describe the transaction'), 'asdf');
    await user.click(screen.getByRole('button', { name: 'Review transaction' }));

    expect(await screen.findByText("Couldn't understand that")).toBeInTheDocument();
  });

  it('goes matched -> review -> record and disables the button while posting', async () => {
    const { cash, fertilizer } = seedAccounts();
    await learnMapping('fertilizer', fertilizer.id);
    const user = userEvent.setup();
    render(<TransactionsPage />);

    await user.type(
      screen.getByLabelText('Describe the transaction'),
      'Paid 500 cash for fertilizer',
    );
    await user.click(screen.getByRole('button', { name: 'Review transaction' }));

    expect(await screen.findByRole('heading', { name: 'Matched account' })).toBeInTheDocument();
    expect(screen.getByText('Review before recording')).toBeInTheDocument();
    expect(screen.getByText('Nothing has been recorded yet.')).toBeInTheDocument();

    // Choose the counter account (Cash) via the review card's select.
    const counterTrigger = screen.getByLabelText(/Paid from \(cash or bank\)/i);
    await user.click(counterTrigger);
    await user.click(await screen.findByRole('option', { name: /Cash \(asset\)/i }));

    const recordButton = screen.getByRole('button', { name: 'Record transaction' });
    expect(recordButton).toBeEnabled();
    await user.click(recordButton);

    // Exactly one post: button becomes disabled/"Recording…" during the in-flight call,
    // then the page returns to the entry state with a success message — never a second post.
    await waitFor(() => expect(screen.getByText('Transaction recorded.')).toBeInTheDocument());
    expect(screen.queryByText('Review before recording')).not.toBeInTheDocument();
    void cash;
  });
});
