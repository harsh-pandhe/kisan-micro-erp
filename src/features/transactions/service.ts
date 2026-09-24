/**
 * Milestone 6 transaction workflow service: the ONLY place in the app that
 * inserts into or reads the `transactions` table. It never duplicates the
 * parser (M4), the classifier (M5), or the double-entry logic (M3) — it
 * only records the `transactions` row and delegates posting to the
 * existing `postPurchase`/`postSale`/`postPayment`/`postReceipt` helpers
 * from `src/features/accounting`, which are the only place allowed to
 * write `journal_entries`/`journal_lines`.
 *
 * Nothing is written here until the caller (the UI) has an explicit user
 * confirmation — see docs/milestone-6.md, "No auto-posting".
 */
import { getDatabase, persistDatabase } from '../../db/database';
import {
  postPayment,
  postPurchase,
  postReceipt,
  postSale,
  type JournalEntryWithLines,
} from '../accounting';
import type { SqlValue } from '../../db/types';
import type { InputMethod, RecordTransactionInput, TransactionHistoryItem } from './types';

interface TransactionHistoryRow extends Record<string, SqlValue> {
  id: number;
  raw_text: string;
  input_method: string;
  status: string;
  created_at: string;
  journal_entry_id: number | null;
  date: string | null;
  voucher_type: string | null;
  narration: string | null;
  amount_minor: number | null;
}

function rowToHistoryItem(row: TransactionHistoryRow): TransactionHistoryItem {
  return {
    id: row.id,
    rawText: row.raw_text,
    inputMethod: row.input_method as InputMethod,
    status: row.status as TransactionHistoryItem['status'],
    createdAt: row.created_at,
    journalEntryId: row.journal_entry_id,
    date: row.date,
    voucherType: row.voucher_type as TransactionHistoryItem['voucherType'],
    narration: row.narration,
    amountMinor: row.amount_minor,
  };
}

function postForType(
  type: RecordTransactionInput['type'],
  input: RecordTransactionInput,
  sourceTransactionId: number,
): Promise<JournalEntryWithLines> {
  const shared = {
    date: input.date,
    amountMinor: input.amountMinor,
    narration: input.narration ?? null,
    sourceTransactionId,
  };
  switch (type) {
    case 'purchase':
      return postPurchase({
        ...shared,
        expenseOrItemAccountId: input.classifiedAccountId,
        cashOrCreditorAccountId: input.counterAccountId,
      });
    case 'sale':
      return postSale({
        ...shared,
        cashOrDebtorAccountId: input.counterAccountId,
        salesAccountId: input.classifiedAccountId,
      });
    case 'payment':
      return postPayment({
        ...shared,
        expenseOrCreditorAccountId: input.classifiedAccountId,
        cashOrBankAccountId: input.counterAccountId,
      });
    case 'receipt':
      return postReceipt({
        ...shared,
        cashOrBankAccountId: input.counterAccountId,
        incomeOrDebtorAccountId: input.classifiedAccountId,
      });
  }
}

/**
 * Records a `transactions` row and posts the corresponding journal entry
 * (via the appropriate M3 operation), linking the two via
 * `sourceTransactionId`/`journal_entry_id`. Only ever called after explicit
 * user confirmation in the UI.
 *
 * On any posting failure, the `transactions` row is marked `rejected`
 * (never left dangling as `pending`) and the error is re-thrown so the UI
 * can show it — no partial journal data is ever left behind, since
 * `postJournalEntry` itself only commits and persists on full success.
 */
export async function recordTransaction(
  input: RecordTransactionInput,
): Promise<{ transactionId: number; journalEntry: JournalEntryWithLines }> {
  const db = getDatabase();

  db.run(
    `INSERT INTO transactions (raw_text, input_method, parsed_at, status) VALUES (?, ?, datetime('now'), 'parsed')`,
    [input.rawText, input.inputMethod],
  );
  const [{ id: transactionId }] = db.query<{ id: number }>('SELECT last_insert_rowid() as id');

  try {
    const journalEntry = await postForType(input.type, input, transactionId);
    db.run(`UPDATE transactions SET journal_entry_id = ?, status = 'posted' WHERE id = ?`, [
      journalEntry.id,
      transactionId,
    ]);
    await persistDatabase();
    return { transactionId, journalEntry };
  } catch (cause) {
    try {
      db.run(`UPDATE transactions SET status = 'rejected' WHERE id = ?`, [transactionId]);
      await persistDatabase();
    } catch {
      // Best-effort cleanup only; the original posting error below is what
      // must reach the caller.
    }
    throw cause;
  }
}

/** Lists transactions newest-first, joined with their posted journal entry (if any). */
export function listTransactionHistory(limit = 50): TransactionHistoryItem[] {
  const db = getDatabase();
  const rows = db.query<TransactionHistoryRow>(
    `SELECT
       t.id as id, t.raw_text as raw_text, t.input_method as input_method,
       t.status as status, t.created_at as created_at, t.journal_entry_id as journal_entry_id,
       je.date as date, je.voucher_type as voucher_type, je.narration as narration,
       (SELECT jl.amount_minor FROM journal_lines jl
          WHERE jl.journal_entry_id = je.id ORDER BY jl.id LIMIT 1) as amount_minor
     FROM transactions t
     LEFT JOIN journal_entries je ON je.id = t.journal_entry_id
     ORDER BY t.id DESC
     LIMIT ?`,
    [limit],
  );
  return rows.map(rowToHistoryItem);
}

/** Total number of recorded transaction rows (used by the dashboard's simple count). */
export function countTransactions(): number {
  const db = getDatabase();
  const [{ count }] = db.query<{ count: number }>('SELECT COUNT(*) as count FROM transactions');
  return count;
}
