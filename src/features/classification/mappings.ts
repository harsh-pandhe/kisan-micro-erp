/**
 * CRUD over `item_mappings`. Only touches SQLite through the Milestone 2
 * `AppDatabase` surface (`getDatabase()`), mirroring the pattern in
 * `src/features/accounting/accounts.ts`. This module never posts journal
 * entries and never touches `journal_entries`/`journal_lines`.
 */
import { getAccount } from '../accounting/accounts';
import { getDatabase } from '../../db/database';
import type { SqlValue } from '../../db/types';
import { normalizeForClassification } from './normalize';
import { MappingAccountNotFoundError, MappingValidationError } from './types';
import type { ItemMapping } from './types';

interface ItemMappingRow extends Record<string, SqlValue> {
  id: number;
  item_name_normalized: string;
  account_id: number;
  created_at: string;
}

function rowToMapping(row: ItemMappingRow): ItemMapping {
  return {
    id: row.id,
    itemNameNormalized: row.item_name_normalized,
    accountId: row.account_id,
    createdAt: row.created_at,
  };
}

/** Looks up a mapping by its already-normalized key, or null if none exists. */
export function findMappingByNormalizedKey(normalizedKey: string): ItemMapping | null {
  const db = getDatabase();
  const rows = db.query<ItemMappingRow>(
    'SELECT * FROM item_mappings WHERE item_name_normalized = ?',
    [normalizedKey],
  );
  return rows.length > 0 ? rowToMapping(rows[0]) : null;
}

/** Lists all stored mappings. Callers must not rely on row insertion order for matching. */
export function listMappings(): ItemMapping[] {
  const db = getDatabase();
  const rows = db.query<ItemMappingRow>(
    'SELECT * FROM item_mappings ORDER BY item_name_normalized',
  );
  return rows.map(rowToMapping);
}

function validateSourceKey(sourceKey: string): string {
  const normalized = normalizeForClassification(sourceKey ?? '');
  if (normalized.length === 0) {
    throw new MappingValidationError('Mapping source key must not be empty after normalization');
  }
  return normalized;
}

function validateAccountExists(accountId: number): void {
  const account = getAccount(accountId);
  if (!account) {
    throw new MappingAccountNotFoundError(`Account id ${accountId} does not exist`);
  }
}

/**
 * Creates a mapping for a normalized key that does not yet exist. Rejects
 * (via `MappingValidationError`/`MappingAccountNotFoundError`) rather than
 * silently updating — use `upsertMapping` for the create-or-update flow.
 * Never auto-creates the target account.
 */
export function createMapping(sourceKey: string, accountId: number): ItemMapping {
  const normalizedKey = validateSourceKey(sourceKey);
  validateAccountExists(accountId);

  const db = getDatabase();
  const existing = findMappingByNormalizedKey(normalizedKey);
  if (existing) {
    throw new MappingValidationError(
      `A mapping for "${normalizedKey}" already exists (use updateMapping to change it)`,
    );
  }

  db.run('INSERT INTO item_mappings (item_name_normalized, account_id) VALUES (?, ?)', [
    normalizedKey,
    accountId,
  ]);

  const created = findMappingByNormalizedKey(normalizedKey);
  if (!created) {
    // Unreachable: we just inserted this row.
    throw new MappingValidationError('Mapping could not be re-read after insert');
  }
  return created;
}

/**
 * Updates the account for an existing mapping. Explicit, distinct
 * operation from classification and from creating a new mapping — never
 * invoked implicitly as a side effect of `classify`.
 */
export function updateMapping(sourceKey: string, accountId: number): ItemMapping {
  const normalizedKey = validateSourceKey(sourceKey);
  validateAccountExists(accountId);

  const db = getDatabase();
  const existing = findMappingByNormalizedKey(normalizedKey);
  if (!existing) {
    throw new MappingValidationError(
      `No mapping exists for "${normalizedKey}" (use createMapping to add one)`,
    );
  }

  db.run('UPDATE item_mappings SET account_id = ? WHERE item_name_normalized = ?', [
    accountId,
    normalizedKey,
  ]);

  const updated = findMappingByNormalizedKey(normalizedKey);
  if (!updated) {
    throw new MappingValidationError('Mapping could not be re-read after update');
  }
  return updated;
}

/**
 * Idempotent create-or-update: if a mapping for the normalized key already
 * exists it is updated to point at the given account (deterministic per
 * the schema's UNIQUE constraint on `item_name_normalized`); otherwise a
 * new mapping is created. This is the primitive `learnMapping` builds on.
 */
export function upsertMapping(sourceKey: string, accountId: number): ItemMapping {
  const normalizedKey = validateSourceKey(sourceKey);
  validateAccountExists(accountId);

  const existing = findMappingByNormalizedKey(normalizedKey);
  if (existing) {
    if (existing.accountId === accountId) {
      // No-op update: nothing changed, avoid a pointless write.
      return existing;
    }
    return updateMapping(normalizedKey, accountId);
  }
  return createMapping(normalizedKey, accountId);
}
