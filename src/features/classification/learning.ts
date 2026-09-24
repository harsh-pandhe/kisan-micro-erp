/**
 * Self-learning entry points: turn a confirmed item->account choice into a
 * persisted mapping. Same commit-then-persist discipline as
 * `src/features/accounting/posting.ts` — `persistDatabase()` is only ever
 * called after a successful SQLite write, never before, and this module
 * never writes to IndexedDB directly (no second persistence path).
 *
 * Learning is a distinct operation from classification and from posting:
 * it never calls `postJournalEntry` or any other M3 operation.
 */
import { persistDatabase } from '../../db/database';
import { createMapping, updateMapping, upsertMapping } from './mappings';
import type { ItemMapping } from './types';

/**
 * Learns (creates) a new mapping from `sourceKey` to `accountId`. Rejects
 * if the account does not exist or a mapping for this key already exists
 * (use `relearnMapping` to change an existing one). Persists to IndexedDB
 * only after the SQLite insert has committed successfully.
 */
export async function learnMapping(sourceKey: string, accountId: number): Promise<ItemMapping> {
  const mapping = createMapping(sourceKey, accountId);
  await persistDatabase();
  return mapping;
}

/**
 * Explicitly updates an existing mapping to a new account. This is a
 * distinct, user-initiated operation — never an automatic side effect of
 * `classify()`.
 */
export async function relearnMapping(sourceKey: string, accountId: number): Promise<ItemMapping> {
  const mapping = updateMapping(sourceKey, accountId);
  await persistDatabase();
  return mapping;
}

/**
 * Create-or-update in one call: convenient for callers (e.g. a future
 * confirmation UI) that don't need to know whether the key was previously
 * mapped. Deterministic per the `item_name_normalized` UNIQUE constraint.
 */
export async function learnOrUpdateMapping(
  sourceKey: string,
  accountId: number,
): Promise<ItemMapping> {
  const mapping = upsertMapping(sourceKey, accountId);
  await persistDatabase();
  return mapping;
}
