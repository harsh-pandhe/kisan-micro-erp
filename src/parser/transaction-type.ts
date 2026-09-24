/**
 * Deterministic keyword-based transaction-type recognition. Closed
 * vocabulary only — see docs/parser-spec.md for the full table. No
 * fuzzy/semantic inference: an unrecognized phrase yields `undefined`.
 */

import type { ParsedTransactionType } from './types';

const KEYWORDS: Array<{ type: ParsedTransactionType; pattern: RegExp }> = [
  // Purchase: "bought", "purchased", "kharida"/"kharidi", "khareeda", "kharcha" (expense)
  { type: 'purchase', pattern: /\b(bought|purchased|kharid[ai]?|khareed[ai]?|kharcha)\b/ },
  // Sale: "sold", "becha"/"bechi", "sale hui"
  { type: 'sale', pattern: /\b(sold|bech[ai]?|sale\s+hui)\b/ },
  // Payment: "paid", "diya"/"diye" (gave), "payment"
  { type: 'payment', pattern: /\b(paid|diy[ae]|payment)\b/ },
  // Receipt: "received", "mila"/"mili", "receipt"
  { type: 'receipt', pattern: /\b(received|mil[ai]|receipt)\b/ },
];

/**
 * Detect a transaction type from normalized text. Returns undefined when
 * no keyword from the closed vocabulary matches, or when keywords for more
 * than one type both match (ambiguous — caller decides how to report it).
 */
export function detectTransactionTypes(normalized: string): ParsedTransactionType[] {
  const matched: ParsedTransactionType[] = [];
  for (const { type, pattern } of KEYWORDS) {
    if (pattern.test(normalized)) {
      matched.push(type);
    }
  }
  return matched;
}
