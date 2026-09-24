/**
 * Deterministic normalization for classification matching. Consistent in
 * spirit with `src/parser/normalize.ts` (NFKC, trim, collapse whitespace,
 * lowercase) but kept as its own function since classification normalizes
 * short item/keyword strings, not full sentences, and additionally strips
 * matching-irrelevant punctuation and applies a small static Hindi/Hinglish
 * alias table (see docs/milestone-5.md, "Hindi/Hinglish aliases").
 */

/**
 * Static alias -> canonical-English-term table. Deliberately small and
 * explicit: NOT translation/NLP, just a fixed lookup so a few common
 * Hindi/Hinglish terms resolve to the same normalized key as their English
 * equivalent for matching purposes. Documented exhaustively in
 * docs/milestone-5.md.
 */
const ALIAS_TABLE: ReadonlyMap<string, string> = new Map([
  ['khaad', 'fertilizer'],
  ['khad', 'fertilizer'],
  ['urvarak', 'fertilizer'],
  ['beej', 'seeds'],
  ['beej', 'seeds'],
  ['dawai', 'pesticide'],
  ['dawa', 'pesticide'],
  ['keetnashak', 'pesticide'],
  ['diesel', 'diesel'],
]);

/** Strips punctuation that carries no matching meaning, keeping word boundaries intact. */
function stripPunctuation(text: string): string {
  // Replace punctuation with a space (not remove outright) so token
  // boundaries are preserved, e.g. "diesel," -> "diesel ".
  return text.replace(/[.,;:!?'"()[\]{}₹/\\-]+/g, ' ');
}

/**
 * Normalizes a single word/token for alias lookup: NFKC, lowercase, no
 * punctuation. Applies the alias table if the token has a known alias.
 */
function normalizeToken(token: string): string {
  const canonical = ALIAS_TABLE.get(token);
  return canonical ?? token;
}

/**
 * Normalizes free text (item/description or merchant/party string) into a
 * deterministic matching key: NFKC-normalized, trimmed, punctuation
 * stripped, whitespace collapsed to single spaces, lowercased, and with any
 * recognized Hindi/Hinglish alias words replaced by their canonical English
 * term. Same input always yields the same output.
 */
export function normalizeForClassification(raw: string): string {
  const nfkc = raw.normalize('NFKC');
  const lower = nfkc.toLowerCase();
  const noPunctuation = stripPunctuation(lower);
  const collapsed = noPunctuation.trim().replace(/\s+/g, ' ');
  if (collapsed.length === 0) return '';
  const tokens = collapsed.split(' ').map(normalizeToken);
  return tokens.join(' ');
}

/** Tokenizes an already-normalized string into whitespace-separated words. */
export function tokenize(normalized: string): string[] {
  if (normalized.length === 0) return [];
  return normalized.split(' ').filter((t) => t.length > 0);
}
