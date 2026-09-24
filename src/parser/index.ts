/**
 * Deterministic transaction text parser (Milestone 4).
 *
 * Pipeline: raw text -> normalization -> deterministic extraction ->
 * ParsedTransaction -> validation -> ParseResult (SUCCESS / AMBIGUOUS /
 * INVALID). Pure function of its input text plus an optional injected
 * reference date; no I/O, no database, no network, no ML/LLM/fuzzy
 * matching. See docs/parser-spec.md and docs/milestone-4.md.
 */

import { findAmountToken, parseAmount } from './amount';
import { extractDate } from './date';
import { normalizeText } from './normalize';
import { extractParty, extractDescription } from './party';
import { extractPaymentModes } from './payment-mode';
import { detectTransactionTypes } from './transaction-type';
import type { ParsedTransaction, ParseResult } from './types';
import { validateParsedTransaction } from './validate';

export * from './types';
export { normalizeText } from './normalize';
export { parseAmount, findAmountToken } from './amount';
export { extractDate, isValidCalendarDate } from './date';
export { detectTransactionTypes } from './transaction-type';
export { extractPaymentModes } from './payment-mode';
export { extractParty, extractDescription } from './party';
export { validateParsedTransaction } from './validate';

/**
 * Parse raw transaction text into a discriminated ParseResult.
 *
 * @param rawText the raw, unmodified user input.
 * @param referenceDate the "now" used to resolve relative dates like
 *   "today"/"yesterday". Defaults to the real current date — the one place
 *   in this module allowed to call `new Date()`. Pass an explicit value in
 *   tests for determinism.
 */
export function parseTransactionText(
  rawText: string,
  referenceDate: Date = new Date(),
): ParseResult {
  const normalizedText = normalizeText(rawText);

  if (normalizedText.length === 0) {
    return { status: 'INVALID', rawText, reasons: ['empty input'] };
  }

  const types = detectTransactionTypes(normalizedText);
  const paymentModes = extractPaymentModes(normalizedText);
  const amountToken = findAmountToken(normalizedText);

  const reasons: string[] = [];

  // Amount: must find exactly one well-formed candidate.
  let amount: ParsedTransaction['amount'];
  if (!amountToken) {
    reasons.push('no amount found in text');
  } else {
    const amountResult = parseAmount(amountToken);
    if (amountResult.ok) {
      amount = amountResult.amount;
    } else {
      return { status: 'INVALID', rawText, reasons: [`invalid amount: ${amountResult.reason}`] };
    }
  }

  // Transaction type: exactly one keyword match required; zero or many is
  // ambiguous/unsupported, never guessed.
  let type: ParsedTransaction['type'];
  if (types.length === 0) {
    reasons.push('no recognized transaction-type keyword found');
  } else if (types.length > 1) {
    reasons.push(`ambiguous transaction type: matched ${types.join(', ')}`);
  } else {
    type = types[0];
  }

  // Payment mode: at most one explicit keyword; more than one is ambiguous.
  let paymentMode: ParsedTransaction['paymentMode'];
  if (paymentModes.length === 1) {
    paymentMode = paymentModes[0];
  } else if (paymentModes.length > 1) {
    reasons.push(`ambiguous payment mode: matched ${paymentModes.join(', ')}`);
  }

  const date = extractDate(normalizedText, referenceDate);
  const party = extractParty(normalizedText);
  const description = extractDescription(normalizedText);

  const transaction: ParsedTransaction = {
    type,
    amount,
    party,
    description,
    date,
    paymentMode,
    rawText,
    normalizedText,
  };

  // A bare amount with no verb/context (no type keyword, no party, no
  // description, no payment mode) must never become a confident SUCCESS —
  // it is unsupported/ambiguous input, not a guessed transaction.
  const hasAnyContext =
    type !== undefined ||
    party !== undefined ||
    description !== undefined ||
    paymentMode !== undefined;
  if (!type && !hasAnyContext && amount) {
    return {
      status: 'INVALID',
      rawText,
      reasons: ['bare amount with no transaction-type keyword or context'],
    };
  }

  if (reasons.length > 0) {
    // Some required info is present but the input is underspecified or
    // conflicting -> AMBIGUOUS, not a silent failure and not a guess.
    if (amount || type || party || description) {
      return { status: 'AMBIGUOUS', transaction, reasons };
    }
    return { status: 'INVALID', rawText, reasons };
  }

  const validationReasons = validateParsedTransaction(transaction);
  if (validationReasons.length > 0) {
    return { status: 'AMBIGUOUS', transaction, reasons: validationReasons };
  }

  return { status: 'SUCCESS', transaction };
}
