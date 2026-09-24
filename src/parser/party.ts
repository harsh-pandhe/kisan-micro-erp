/**
 * Deterministic merchant/party and description/item extraction using
 * explicit textual patterns only. No DB lookups, no semantic matching.
 *
 * Supported patterns (see docs/parser-spec.md):
 *  - "from X"   -> party = X   (typically a receipt source)
 *  - "to X"     -> party = X   (typically a payment recipient)
 *  - "for X"    -> description = X (item/reason, not a party)
 *  - "X ke liye" -> description = X (Hinglish equivalent of "for X")
 */

function titleCase(text: string): string {
  return text
    .split(' ')
    .filter((word) => word.length > 0)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

/** Strip a trailing amount/date/payment-mode fragment so extraction stops there. */
const STOP_WORDS =
  /\s+(₹|rs\.?|inr|rupees?|rupaye|via|through|by|cash|upi|bank|card|today|yesterday|aaj|kal|\d).*$/i;

function extractAfter(normalized: string, keyword: RegExp): string | undefined {
  const match = normalized.match(keyword);
  if (!match) return undefined;
  const rest = normalized.slice((match.index ?? 0) + match[0].length);
  const cleaned = rest.replace(STOP_WORDS, '').trim();
  return cleaned.length > 0 ? titleCase(cleaned) : undefined;
}

export function extractParty(normalized: string): string | undefined {
  return extractAfter(normalized, /\bfrom\s+/i) ?? extractAfter(normalized, /\bto\s+/i);
}

export function extractDescription(normalized: string): string | undefined {
  // "for" is used in two directions depending on the verb:
  //  - "Paid ₹Y cash for X"     -> item follows "for"
  //  - "Bought/Sold X for ₹Y"   -> item precedes "for", amount follows it
  const forMatch = normalized.match(/\bfor\s+/i);
  if (forMatch) {
    const afterFor = normalized.slice((forMatch.index ?? 0) + forMatch[0].length).trim();
    const followedByAmount = /^(₹|\d|rs\.?\s*\d|rupees?\b)/i.test(afterFor);
    if (!followedByAmount) {
      const cleaned = afterFor.replace(STOP_WORDS, '').trim();
      if (cleaned.length > 0) return titleCase(cleaned);
    } else {
      const before = normalized.slice(0, forMatch.index ?? 0);
      const verbMatch = before.match(
        /\b(?:bought|purchased|sold|kharid[ai]?|khareed[ai]?|bech[ai]?)\s+(.+)$/i,
      );
      if (verbMatch) {
        const candidate = verbMatch[1].trim();
        if (candidate.length > 0) return titleCase(candidate);
      }
    }
  }

  // "X ke liye" — the item precedes the keyword, so capture the single
  // word immediately before it instead of after.
  const keLiyeMatch = normalized.match(/\b([a-z]+)\s+ke\s+liye\b/i);
  if (keLiyeMatch) {
    const candidate = keLiyeMatch[1].trim();
    // Avoid capturing amount/currency tokens as an "item".
    if (!/\d/.test(candidate)) {
      return titleCase(candidate);
    }
  }
  return undefined;
}
