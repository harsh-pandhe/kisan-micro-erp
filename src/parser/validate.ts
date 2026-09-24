/**
 * Structural validation of a ParsedTransaction, kept separate from
 * extraction. Does NOT validate account existence or debit/credit — that
 * is the accounting engine's job (out of scope here).
 */

import { isValidCalendarDate } from './date';
import type { ParsedTransaction } from './types';

const SUPPORTED_TYPES = new Set(['purchase', 'sale', 'payment', 'receipt']);

/**
 * Validate a ParsedTransaction's structural correctness. Returns a list of
 * human-readable reasons; an empty list means the transaction is valid.
 */
export function validateParsedTransaction(transaction: ParsedTransaction): string[] {
  const reasons: string[] = [];

  if (!transaction.type || !SUPPORTED_TYPES.has(transaction.type)) {
    reasons.push('transaction type is missing or unsupported');
  }

  if (!transaction.amount) {
    reasons.push('amount is missing');
  } else {
    if (!Number.isInteger(transaction.amount.minorUnits)) {
      reasons.push('amount minor units must be an integer');
    }
    if (transaction.amount.minorUnits <= 0) {
      reasons.push('amount must be positive');
    }
  }

  if (transaction.date) {
    const isoMatch = transaction.date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!isoMatch) {
      reasons.push('date is not in ISO format');
    } else {
      const [, y, m, d] = isoMatch;
      if (!isValidCalendarDate(Number(y), Number(m), Number(d))) {
        reasons.push('date is not a real calendar date');
      }
    }
  }

  return reasons;
}
