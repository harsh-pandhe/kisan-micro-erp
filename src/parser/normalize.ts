/**
 * Deterministic text normalization. Preserves meaning: does not rewrite
 * words, only whitespace/casing/separator/currency-symbol normalization.
 */

/**
 * Normalize raw user text for parsing:
 * - Unicode NFKC normalization (safe canonicalization of compatible forms).
 * - Trim leading/trailing whitespace.
 * - Collapse internal whitespace runs to a single space.
 * - Lowercase (case carries no grammatical meaning in the supported grammar).
 * - Normalize currency symbol variants (`Rs.`, `Rs`, `INR`, `rupees`) to `₹`
 *   directly preceding the digits where they already are adjacent, and
 *   leaves standalone words like "rupees" intact for the amount parser to
 *   recognize as a suffix form.
 */
export function normalizeText(raw: string): string {
  const nfkc = raw.normalize('NFKC');
  const trimmed = nfkc.trim();
  const collapsed = trimmed.replace(/\s+/g, ' ');
  const lower = collapsed.toLowerCase();
  // Normalize "Rs." / "Rs" / "rs." / "inr" (as a currency marker before a
  // number) to the canonical ₹ symbol so downstream regexes have one form
  // to match against.
  const currencyNormalized = lower
    .replace(/\brs\.?\s*(?=\d)/gi, '₹')
    .replace(/\binr\.?\s*(?=\d)/gi, '₹');
  return currencyNormalized;
}
