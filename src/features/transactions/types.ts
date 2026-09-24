/**
 * Types for Milestone 6: the end-to-end transaction workflow that wires the
 * Milestone 4 parser, Milestone 5 classifier and Milestone 3 accounting
 * engine together behind a typed service the UI calls instead of touching
 * SQL. See docs/milestone-6.md.
 */
import type { ParsedTransactionType } from '../../parser/types';

export type InputMethod = 'text' | 'speech';
export type TransactionRowStatus =
  'pending' | 'parsed' | 'needs_classification' | 'posted' | 'rejected';

/** One row of the `transactions` table joined with its posted journal entry, if any. */
export interface TransactionHistoryItem {
  id: number;
  rawText: string;
  inputMethod: InputMethod;
  status: TransactionRowStatus;
  createdAt: string;
  journalEntryId: number | null;
  date: string | null;
  voucherType: ParsedTransactionType | null;
  narration: string | null;
  amountMinor: number | null;
}

/** Input to `recordTransaction`: everything the user has already confirmed. */
export interface RecordTransactionInput {
  rawText: string;
  inputMethod: InputMethod;
  type: ParsedTransactionType;
  amountMinor: number;
  date: string;
  /** The account resolved by classification (the item/expense/income ledger). */
  classifiedAccountId: number;
  /** The counter account the user picked (cash, bank, or a party ledger). */
  counterAccountId: number;
  narration?: string | null;
}
