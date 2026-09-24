/**
 * Read-only query primitives over journal entries/lines and account
 * balances. No report building (Trial Balance/P&L/Balance Sheet) here —
 * see docs/milestone-3.md for what is deliberately out of scope.
 */
import { getDatabase } from '../../db/database';
import type { SqlValue } from '../../db/types';
import { listAccounts } from './accounts';
import { isDebitNormal } from './types';
import type {
  Account,
  JournalEntry,
  JournalEntryWithLines,
  JournalLine,
  VoucherType,
} from './types';

interface JournalEntryRow extends Record<string, SqlValue> {
  id: number;
  voucher_type: string;
  voucher_number: string;
  date: string;
  narration: string | null;
  source_transaction_id: number | null;
  created_at: string;
}

interface JournalLineRow extends Record<string, SqlValue> {
  id: number;
  journal_entry_id: number;
  account_id: number;
  side: string;
  amount_minor: number;
  narration: string | null;
}

function rowToEntry(row: JournalEntryRow): JournalEntry {
  return {
    id: row.id,
    voucherType: row.voucher_type as VoucherType,
    voucherNumber: row.voucher_number,
    date: row.date,
    narration: row.narration,
    sourceTransactionId: row.source_transaction_id,
    createdAt: row.created_at,
  };
}

function rowToLine(row: JournalLineRow): JournalLine {
  return {
    id: row.id,
    journalEntryId: row.journal_entry_id,
    accountId: row.account_id,
    side: row.side as JournalLine['side'],
    amountMinor: row.amount_minor,
    narration: row.narration,
  };
}

/** Fetches one journal entry with its lines, or null if it doesn't exist. */
export function getJournalEntry(id: number): JournalEntryWithLines | null {
  const db = getDatabase();
  const rows = db.query<JournalEntryRow>('SELECT * FROM journal_entries WHERE id = ?', [id]);
  if (rows.length === 0) return null;
  const lines = getJournalLines(id);
  return { ...rowToEntry(rows[0]), lines };
}

/** Lists journal entries, most recent first, optionally filtered by voucher type. */
export function listJournalEntries(options?: {
  voucherType?: VoucherType;
  limit?: number;
}): JournalEntry[] {
  const db = getDatabase();
  const limit = options?.limit ?? 100;
  const rows = options?.voucherType
    ? db.query<JournalEntryRow>(
        'SELECT * FROM journal_entries WHERE voucher_type = ? ORDER BY id DESC LIMIT ?',
        [options.voucherType, limit],
      )
    : db.query<JournalEntryRow>('SELECT * FROM journal_entries ORDER BY id DESC LIMIT ?', [limit]);
  return rows.map(rowToEntry);
}

/** Fetches all lines belonging to one journal entry, in insertion order. */
export function getJournalLines(journalEntryId: number): JournalLine[] {
  const db = getDatabase();
  const rows = db.query<JournalLineRow>(
    'SELECT * FROM journal_lines WHERE journal_entry_id = ? ORDER BY id',
    [journalEntryId],
  );
  return rows.map(rowToLine);
}

/**
 * Computes an account's balance in integer minor units, signed per its
 * normal balance side: positive means a balance on the account's normal
 * side (e.g. a positive asset balance is a debit balance), negative means
 * the account has gone the "wrong" way. Assets/Expenses are debit-normal;
 * Liabilities/Equity/Income are credit-normal (see docs/accounting-model.md).
 */
export function getAccountBalance(accountId: number): number {
  const db = getDatabase();
  const accountRows = db.query<{ type: string }>('SELECT type FROM accounts WHERE id = ?', [
    accountId,
  ]);
  if (accountRows.length === 0) {
    return 0;
  }
  const debitNormal = isDebitNormal(accountRows[0].type as Account['type']);

  const sums = db.query<{ side: string; total: number }>(
    `SELECT side, COALESCE(SUM(amount_minor), 0) as total
     FROM journal_lines WHERE account_id = ? GROUP BY side`,
    [accountId],
  );
  let debitTotal = 0;
  let creditTotal = 0;
  for (const row of sums) {
    if (row.side === 'debit') debitTotal = row.total;
    else creditTotal = row.total;
  }
  return debitNormal ? debitTotal - creditTotal : creditTotal - debitTotal;
}

/** Returns every account in the chart of accounts (thin alias over `listAccounts`). */
export function getAllAccounts(): Account[] {
  return listAccounts();
}
