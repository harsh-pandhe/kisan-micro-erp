/**
 * Types for the deterministic transaction text parser (Milestone 4).
 *
 * This module has NO dependency on SQLite, IndexedDB, the accounting
 * engine, React, account IDs, journal entries, or reports. See
 * `docs/parser-spec.md` and `docs/milestone-4.md` for the grammar and
 * semantics this module implements.
 */

/** Closed set of deterministically-recognized transaction types. */
export type ParsedTransactionType = 'purchase' | 'sale' | 'payment' | 'receipt';

/** Closed set of deterministically-recognized payment modes. */
export type ParsedPaymentMode = 'cash' | 'upi' | 'bank' | 'card';

/**
 * An amount expressed in integer minor units (paise for INR), never a
 * JS float. `1 rupee === 100 minor units`.
 */
export interface ParsedAmount {
  minorUnits: number;
  /** Currency is always INR for Phase 1; kept explicit for future-proofing. */
  currency: 'INR';
}

/** A transaction fully or partially extracted from raw text. */
export interface ParsedTransaction {
  type: ParsedTransactionType | undefined;
  amount: ParsedAmount | undefined;
  /** Merchant/party name extracted via explicit "from X" / "to X" patterns. */
  party: string | undefined;
  /** Free-text item/description, e.g. extracted via "for X" / "X ke liye". */
  description: string | undefined;
  /** ISO 8601 date (YYYY-MM-DD) if explicitly present in the text, else undefined. */
  date: string | undefined;
  paymentMode: ParsedPaymentMode | undefined;
  /** Original, unmodified user input. */
  rawText: string;
  /** Normalized text actually matched against the grammar. */
  normalizedText: string;
}

/** Discriminated parse outcome. Never guesses: favors explicit failure. */
export type ParseResult =
  | { status: 'SUCCESS'; transaction: ParsedTransaction }
  | { status: 'AMBIGUOUS'; transaction: ParsedTransaction; reasons: string[] }
  | { status: 'INVALID'; rawText: string; reasons: string[] };

/** Result of amount parsing alone. */
export type AmountParseResult = { ok: true; amount: ParsedAmount } | { ok: false; reason: string };
