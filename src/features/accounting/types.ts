/**
 * Domain types for the double-entry accounting engine. Mirrors
 * `src/db/schema.ts` exactly — see docs/database-schema.md and
 * docs/accounting-model.md.
 */

/** Matches the `accounts.type` CHECK constraint. */
export type AccountType = 'asset' | 'liability' | 'equity' | 'income' | 'expense';

/** Matches the `journal_entries.voucher_type` CHECK constraint. */
export type VoucherType = 'purchase' | 'sale' | 'payment' | 'receipt' | 'journal';

/** Matches the `journal_lines.side` CHECK constraint. */
export type JournalSide = 'debit' | 'credit';

export interface Account {
  id: number;
  code: string;
  name: string;
  type: AccountType;
  parentId: number | null;
  isSystem: boolean;
  createdAt: string;
}

export interface NewAccountInput {
  code: string;
  name: string;
  type: AccountType;
  parentId?: number | null;
  isSystem?: boolean;
}

/** A single unposted debit/credit line, amount in integer minor units (paise). */
export interface NewJournalLine {
  accountId: number;
  side: JournalSide;
  amountMinor: number;
  narration?: string | null;
}

export interface JournalLine extends NewJournalLine {
  id: number;
  journalEntryId: number;
}

/** A fully-formed, not-yet-posted journal entry. */
export interface NewJournalEntry {
  voucherType: VoucherType;
  /** Optional: when omitted, `postJournalEntry` generates one deterministically. */
  voucherNumber?: string;
  date: string;
  narration?: string | null;
  sourceTransactionId?: number | null;
  lines: NewJournalLine[];
}

export interface JournalEntry {
  id: number;
  voucherType: VoucherType;
  voucherNumber: string;
  date: string;
  narration: string | null;
  sourceTransactionId: number | null;
  createdAt: string;
}

export interface JournalEntryWithLines extends JournalEntry {
  lines: JournalLine[];
}

/** Whether an account type normally carries a debit or credit balance. */
export const DEBIT_NORMAL_TYPES: ReadonlySet<AccountType> = new Set(['asset', 'expense']);
export const CREDIT_NORMAL_TYPES: ReadonlySet<AccountType> = new Set([
  'liability',
  'equity',
  'income',
]);

export function isDebitNormal(type: AccountType): boolean {
  return DEBIT_NORMAL_TYPES.has(type);
}
