/**
 * Deterministic classification: maps a Milestone 4 `ParsedTransaction` to
 * an account using stored `item_mappings`, per the precedence documented
 * in docs/milestone-5.md:
 *
 *   1. Exact normalized mapping lookup.
 *   2. Explicit keyword matching with real token boundaries (never naive
 *      substring matching — "oil" never matches "soil").
 *   3. No match -> UNKNOWN.
 *
 * This module never posts journal entries, never mutates balances, and
 * never auto-creates accounts. It reads `item_mappings` and accounts only
 * for lookup purposes.
 */
import { getAccount } from '../accounting/accounts';
import type { ParsedTransaction } from '../../parser/types';
import { listMappings, findMappingByNormalizedKey } from './mappings';
import { normalizeForClassification, tokenize } from './normalize';
import type { ClassificationCandidate, ClassifiedTransaction, ItemMapping } from './types';

/**
 * Which `ParsedTransaction` field classification matches against.
 *
 * Rule (documented in docs/milestone-5.md): item_mappings is an
 * ITEM-keyed table (`item_name_normalized`), so classification always
 * matches against `transaction.description` (the free-text item/purpose,
 * e.g. "fertilizer", "diesel") — never `transaction.party` (the
 * merchant/counterparty name). If `description` is missing, classification
 * cannot reliably proceed and returns INVALID rather than guessing from
 * the merchant name.
 */
function getClassificationSourceText(transaction: ParsedTransaction): string | undefined {
  return transaction.description;
}

function buildMatched(
  transaction: ParsedTransaction,
  mapping: ItemMapping,
  source: 'exact_mapping' | 'keyword_mapping',
  reason: string,
): ClassifiedTransaction {
  const account = getAccount(mapping.accountId);
  if (!account) {
    // The mapping points at an account that no longer exists (e.g. deleted
    // out from under it). Never invent an account — surface as unknown.
    return {
      transaction,
      status: 'unknown',
      accountId: undefined,
      requiresConfirmation: true,
      reason: `Mapping for "${mapping.itemNameNormalized}" references a nonexistent account`,
    };
  }
  return {
    transaction,
    status: 'matched',
    accountId: account.id,
    account,
    matchSource: source,
    mapping,
    requiresConfirmation: false,
    reason,
  };
}

/**
 * Finds every stored mapping whose full normalized key is present in
 * `transactionTokens` as a contiguous run of whole tokens (real word/token
 * boundaries — never a naive substring test). Iterates over all mappings
 * so the result does not depend on their insertion/row order.
 */
function findKeywordCandidates(
  transactionTokens: string[],
  mappings: ItemMapping[],
): { mapping: ItemMapping; specificity: number }[] {
  const candidates: { mapping: ItemMapping; specificity: number }[] = [];

  for (const mapping of mappings) {
    const keyTokens = tokenize(mapping.itemNameNormalized);
    if (keyTokens.length === 0) continue;

    for (let start = 0; start <= transactionTokens.length - keyTokens.length; start++) {
      let matches = true;
      for (let i = 0; i < keyTokens.length; i++) {
        if (transactionTokens[start + i] !== keyTokens[i]) {
          matches = false;
          break;
        }
      }
      if (matches) {
        candidates.push({ mapping, specificity: keyTokens.length });
        break; // one match per mapping is enough to count it as a candidate
      }
    }
  }

  // Sort deterministically by normalized key so output order never depends
  // on DB row insertion order.
  candidates.sort((a, b) =>
    a.mapping.itemNameNormalized.localeCompare(b.mapping.itemNameNormalized),
  );
  return candidates;
}

/**
 * Classifies a single parsed transaction against the current set of
 * `item_mappings`. Deterministic: the same transaction and the same DB
 * state always produce the same result, regardless of mapping insertion
 * order.
 */
export function classify(transaction: ParsedTransaction): ClassifiedTransaction {
  const sourceText = getClassificationSourceText(transaction);

  if (!sourceText || sourceText.trim().length === 0) {
    return {
      transaction,
      status: 'invalid',
      accountId: undefined,
      requiresConfirmation: true,
      reason: 'No item/description text available to classify against',
    };
  }

  const normalized = normalizeForClassification(sourceText);
  if (normalized.length === 0) {
    return {
      transaction,
      status: 'invalid',
      accountId: undefined,
      requiresConfirmation: true,
      reason: 'Description normalized to an empty string',
    };
  }

  // 1. Exact normalized mapping lookup.
  const exact = findMappingByNormalizedKey(normalized);
  if (exact) {
    return buildMatched(
      transaction,
      exact,
      'exact_mapping',
      `Exact mapping match for "${normalized}"`,
    );
  }

  // 2. Keyword matching with real token boundaries.
  const transactionTokens = tokenize(normalized);
  const allMappings = listMappings();
  const keywordCandidates = findKeywordCandidates(transactionTokens, allMappings);

  if (keywordCandidates.length > 0) {
    const maxSpecificity = Math.max(...keywordCandidates.map((c) => c.specificity));
    const best = keywordCandidates.filter((c) => c.specificity === maxSpecificity);

    if (best.length === 1) {
      const winner = best[0].mapping;
      return buildMatched(
        transaction,
        winner,
        'keyword_mapping',
        `Keyword match for "${winner.itemNameNormalized}" in "${normalized}"`,
      );
    }

    // Multiple equally-specific candidates: cannot safely pick one.
    const candidates: ClassificationCandidate[] = [];
    for (const c of best) {
      const account = getAccount(c.mapping.accountId);
      if (!account) continue;
      candidates.push({
        accountId: account.id,
        account,
        source: 'keyword_mapping',
        matchedKey: c.mapping.itemNameNormalized,
      });
    }

    if (candidates.length >= 2) {
      return {
        transaction,
        status: 'ambiguous',
        accountId: undefined,
        candidates,
        requiresConfirmation: true,
        reason: `${candidates.length} equally-specific keyword matches for "${normalized}"`,
      };
    }
    // All equally-specific candidates pointed at deleted accounts: falls
    // through to unknown below.
  }

  // 3. No safe match.
  return {
    transaction,
    status: 'unknown',
    accountId: undefined,
    requiresConfirmation: true,
    reason: `No mapping found for "${normalized}"`,
  };
}
