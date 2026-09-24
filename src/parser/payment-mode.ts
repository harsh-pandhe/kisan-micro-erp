/**
 * Deterministic payment-mode recognition from explicit keywords only.
 * Absent from the text -> undefined (never inferred).
 */

import type { ParsedPaymentMode } from './types';

const KEYWORDS: Array<{ mode: ParsedPaymentMode; pattern: RegExp }> = [
  { mode: 'upi', pattern: /\bupi\b/ },
  { mode: 'card', pattern: /\bcard\b/ },
  { mode: 'bank', pattern: /\b(bank|neft|rtgs|imps)\b/ },
  // "cash" keyword; Hinglish "nagad" (cash) also supported.
  { mode: 'cash', pattern: /\b(cash|nagad)\b/ },
];

export function extractPaymentModes(normalized: string): ParsedPaymentMode[] {
  const matched: ParsedPaymentMode[] = [];
  for (const { mode, pattern } of KEYWORDS) {
    if (pattern.test(normalized)) {
      matched.push(mode);
    }
  }
  return matched;
}
