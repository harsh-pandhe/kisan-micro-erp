/**
 * Deterministic amount parsing into integer minor units (paise).
 *
 * Never uses floating-point arithmetic on the final value: the string is
 * split on its decimal point and each half is handled as an integer.
 */

import type { AmountParseResult } from './types';

/**
 * Matches a single money-like token, capturing:
 *  - an optional leading ₹
 *  - an integer part with optional comma thousands separators
 *  - an optional 2-digit decimal (paise) part
 *  - an optional trailing "rupees"/"rs"/"rupaye" word (already stripped to
 *    ₹ by normalization when it precedes the digits; this handles the
 *    trailing-word form, e.g. "500 rupees").
 */
const MONEY_TOKEN = /(₹|rs\.?)?\s*(-?[\d,]*\.?\d*)\s*(rupees?|rupaye)?/i;

/**
 * Extract the first money-like substring from normalized text and parse it.
 * Returns undefined if no candidate substring is found at all (distinct
 * from a malformed candidate, which is a parse failure).
 */
export function findAmountToken(normalized: string): string | undefined {
  // Preferred: an explicit currency marker (₹ prefix or "rupees"/"rupaye"
  // suffix) unambiguously identifies the amount.
  const withMarker = normalized.match(/(₹\s*-?[\d,]*\.?\d+|-?[\d,]*\.?\d+\s*(?:rupees?|rupaye))/i);
  if (withMarker) return withMarker[0];

  // Fallback: a bare number, e.g. "kharcha 500". Explicit DD/MM/YYYY or
  // DD-MM-YYYY dates are stripped first so their digits are never mistaken
  // for an amount.
  const withoutDates = normalized.replace(/\b\d{1,2}[/-]\d{1,2}[/-]\d{4}\b/g, ' ');
  const bare = withoutDates.match(/-?\d[\d,]*(?:\.\d+)?/);
  return bare ? bare[0] : undefined;
}

/**
 * Parse a money token (e.g. "₹1,250.50", "Rs 500", "500 rupees") into
 * integer minor units. Purely deterministic digit-by-digit / integer
 * arithmetic — no floats.
 */
export function parseAmount(token: string): AmountParseResult {
  const trimmed = token.trim();
  if (trimmed.length === 0) {
    return { ok: false, reason: 'empty amount' };
  }

  const match = trimmed.match(MONEY_TOKEN);
  if (!match) {
    return { ok: false, reason: 'no recognizable amount' };
  }

  const [, , numericPart] = match;
  if (!numericPart || numericPart.length === 0) {
    return { ok: false, reason: 'no digits found in amount' };
  }

  if (numericPart.startsWith('-')) {
    return { ok: false, reason: 'negative amounts are not supported' };
  }

  // Reject malformed separators: more than one decimal point, or commas
  // appearing after a decimal point.
  const decimalCount = (numericPart.match(/\./g) ?? []).length;
  if (decimalCount > 1) {
    return { ok: false, reason: 'malformed amount: multiple decimal points' };
  }

  const [integerPartRaw, fractionPartRaw] = numericPart.split('.');
  const integerPartClean = integerPartRaw.replace(/,/g, '');

  if (integerPartClean.length === 0) {
    return { ok: false, reason: 'no integer digits in amount' };
  }
  if (!/^\d+$/.test(integerPartClean)) {
    return { ok: false, reason: 'malformed integer portion' };
  }

  let fractionDigits = '00';
  if (fractionPartRaw !== undefined) {
    if (fractionPartRaw.length === 0) {
      return { ok: false, reason: 'malformed amount: trailing decimal point with no digits' };
    }
    if (!/^\d+$/.test(fractionPartRaw)) {
      return { ok: false, reason: 'malformed fractional portion' };
    }
    if (fractionPartRaw.length > 2) {
      return { ok: false, reason: 'amount has more than 2 decimal digits' };
    }
    fractionDigits = fractionPartRaw.padEnd(2, '0');
  }

  // Integer arithmetic only: concatenate digit strings and parse as a
  // base-10 integer, never via parseFloat.
  const minorUnitsString = `${integerPartClean}${fractionDigits}`.replace(/^0+(?=\d)/, '');
  const minorUnits = Number.parseInt(minorUnitsString, 10);

  if (!Number.isSafeInteger(minorUnits)) {
    return { ok: false, reason: 'amount out of safe integer range' };
  }
  if (minorUnits <= 0) {
    return { ok: false, reason: 'amount must be positive' };
  }

  return { ok: true, amount: { minorUnits, currency: 'INR' } };
}
