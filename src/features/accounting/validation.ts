/**
 * Pure, DB-free structural validation for journal entries. `posting.ts` runs
 * this before it ever opens a SQLite transaction; it does not replace the
 * DB-level CHECK/UNIQUE/FK constraints in `src/db/schema.ts` — both layers
 * hold (see docs/accounting-model.md).
 */
import { UnbalancedEntryError, ValidationError } from './errors';
import type { NewJournalEntry, NewJournalLine, VoucherType } from './types';

const VALID_VOUCHER_TYPES: ReadonlySet<VoucherType> = new Set([
  'purchase',
  'sale',
  'payment',
  'receipt',
  'journal',
]);

function validateLine(line: NewJournalLine, index: number): void {
  if (line.accountId === null || line.accountId === undefined) {
    throw new ValidationError(`Line ${index}: accountId is required`);
  }
  if (!Number.isInteger(line.accountId) || line.accountId <= 0) {
    throw new ValidationError(`Line ${index}: accountId must be a positive integer`);
  }
  if (line.side !== 'debit' && line.side !== 'credit') {
    throw new ValidationError(`Line ${index}: side must be "debit" or "credit"`);
  }
  if (!Number.isInteger(line.amountMinor)) {
    throw new ValidationError(
      `Line ${index}: amountMinor must be an integer (minor units, no floats)`,
    );
  }
  if (line.amountMinor <= 0) {
    throw new ValidationError(
      `Line ${index}: amountMinor must be a positive integer, got ${line.amountMinor}`,
    );
  }
}

/**
 * Validates entry-level structure and the balancing invariant. Does not
 * check that referenced accounts exist — that requires the DB and is done
 * separately in `posting.ts`.
 */
export function validateJournalEntry(entry: NewJournalEntry): void {
  if (!VALID_VOUCHER_TYPES.has(entry.voucherType)) {
    throw new ValidationError(
      `Invalid voucher type "${String(entry.voucherType)}"; must be one of ${[...VALID_VOUCHER_TYPES].join(', ')}`,
    );
  }
  if (!entry.date || !entry.date.trim()) {
    throw new ValidationError('Journal entry date is required');
  }
  if (!entry.lines || entry.lines.length === 0) {
    throw new ValidationError('Journal entry must have at least one line');
  }
  if (entry.lines.length < 2) {
    throw new ValidationError(
      'Journal entry must have at least two lines (single-line entries are rejected)',
    );
  }

  entry.lines.forEach(validateLine);

  assertBalanced(entry.lines);
}

/** The core invariant: sum(debits) === sum(credits), in integer minor units. */
export function assertBalanced(lines: NewJournalLine[]): void {
  let debitTotal = 0;
  let creditTotal = 0;
  for (const line of lines) {
    if (line.side === 'debit') {
      debitTotal += line.amountMinor;
    } else {
      creditTotal += line.amountMinor;
    }
  }
  if (debitTotal !== creditTotal) {
    throw new UnbalancedEntryError(
      `Journal entry is unbalanced: debits=${debitTotal}, credits=${creditTotal}`,
    );
  }
}
