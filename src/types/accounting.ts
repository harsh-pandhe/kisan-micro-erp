/**
 * Core accounting domain types. These mirror the SQLite schema in
 * `src/db/schema.ts` — see docs/database-schema.md for the full design.
 */

export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  /** Optional parent for simple grouping (e.g. "Cash" under "Assets"). */
  parentId: number | null;
  isSystem: boolean;
  createdAt: string;
}

export type EntrySide = 'debit' | 'credit';

export interface JournalLine {
  id: number;
  journalEntryId: number;
  accountId: number;
  side: EntrySide;
  /** Stored as integer paise/minor-unit to avoid floating-point drift. */
  amountMinor: number;
  narration: string | null;
}

export type VoucherType = 'purchase' | 'sale' | 'payment' | 'receipt' | 'journal';

export interface JournalEntry {
  id: number;
  voucherType: VoucherType;
  voucherNumber: string;
  date: string;
  narration: string | null;
  sourceTransactionId: number | null;
  createdAt: string;
}

export type TransactionInputMethod = 'text' | 'speech';

export interface RawTransaction {
  id: number;
  rawText: string;
  inputMethod: TransactionInputMethod;
  parsedAt: string | null;
  journalEntryId: number | null;
  status: 'pending' | 'parsed' | 'needs_classification' | 'posted' | 'rejected';
}

export interface ItemMapping {
  id: number;
  itemNameNormalized: string;
  accountId: number;
  createdAt: string;
}
