/**
 * Atomic posting of a journal entry. This is the ONLY place in the app
 * allowed to INSERT into journal_entries/journal_lines — the UI and the
 * (future) parser must call `postJournalEntry()` and never write those
 * tables directly (see docs/milestone-3.md, "UI/parser boundary").
 *
 * Flow: validate structure -> validate accounts exist -> validate balance
 * (already covered by validateJournalEntry) -> BEGIN -> insert entry ->
 * insert lines -> COMMIT -> persistDatabase(). Any failure before COMMIT
 * rolls back and persistDatabase() is never called for a failed/rolled-back
 * entry.
 */
import { getDatabase, persistDatabase } from '../../db/database';
import { AccountNotFoundError, AccountingDatabaseError, DuplicateVoucherError } from './errors';
import { getJournalEntry } from './journal';
import type { JournalEntryWithLines, NewJournalEntry } from './types';
import { validateJournalEntry } from './validation';
import { generateVoucherNumber } from './voucher';

function isUniqueConstraintError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /unique/i.test(message);
}

/**
 * Validates and atomically posts a journal entry, persisting the result to
 * IndexedDB only after a successful SQLite commit. Throws (and leaves the
 * database untouched) on any validation failure, unknown account, duplicate
 * voucher number, or SQL error.
 */
export async function postJournalEntry(entry: NewJournalEntry): Promise<JournalEntryWithLines> {
  // 1. Structural + balance validation (pure, no DB).
  validateJournalEntry(entry);

  const db = getDatabase();

  // 2. Validate every referenced account actually exists. Never
  // auto-create a missing account — reject explicitly instead.
  for (const line of entry.lines) {
    const rows = db.query<{ id: number }>('SELECT id FROM accounts WHERE id = ?', [line.accountId]);
    if (rows.length === 0) {
      throw new AccountNotFoundError(`Account id ${line.accountId} does not exist`);
    }
  }

  const voucherNumber = entry.voucherNumber ?? generateVoucherNumber(entry.voucherType, entry.date);

  // 3. Atomic insert.
  let insertedId: number;
  let inTransaction = false;
  try {
    db.run('BEGIN');
    inTransaction = true;

    db.run(
      `INSERT INTO journal_entries (voucher_type, voucher_number, date, narration, source_transaction_id)
       VALUES (?, ?, ?, ?, ?)`,
      [
        entry.voucherType,
        voucherNumber,
        entry.date,
        entry.narration ?? null,
        entry.sourceTransactionId ?? null,
      ],
    );

    const idRows = db.query<{ id: number }>('SELECT last_insert_rowid() as id');
    insertedId = idRows[0].id;

    for (const line of entry.lines) {
      db.run(
        `INSERT INTO journal_lines (journal_entry_id, account_id, side, amount_minor, narration)
         VALUES (?, ?, ?, ?, ?)`,
        [insertedId, line.accountId, line.side, line.amountMinor, line.narration ?? null],
      );
    }

    db.run('COMMIT');
    inTransaction = false;
  } catch (cause) {
    if (inTransaction) {
      try {
        db.run('ROLLBACK');
      } catch {
        // Rollback failing is not itself the error we want to surface;
        // the original cause below is.
      }
    }
    if (isUniqueConstraintError(cause)) {
      throw new DuplicateVoucherError(`Voucher number "${voucherNumber}" already exists`, cause);
    }
    throw new AccountingDatabaseError('Failed to post journal entry', cause);
  }

  // 4. Only persist after a successful commit.
  await persistDatabase();

  const posted = getJournalEntry(insertedId);
  if (!posted) {
    // Should be unreachable: we just committed this row.
    throw new AccountingDatabaseError('Posted journal entry could not be re-read');
  }
  return posted;
}
