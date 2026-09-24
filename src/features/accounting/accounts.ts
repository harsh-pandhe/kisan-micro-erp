/**
 * Chart-of-accounts CRUD. Only touches SQLite through the Milestone 2
 * `AppDatabase` surface (`getDatabase()`); no raw SQL outside this module
 * and `journal.ts`/`posting.ts`.
 */
import { getDatabase } from '../../db/database';
import type { SqlValue } from '../../db/types';
import { DuplicateAccountError, ValidationError } from './errors';
import type { Account, AccountType, NewAccountInput } from './types';

const VALID_TYPES: ReadonlySet<AccountType> = new Set([
  'asset',
  'liability',
  'equity',
  'income',
  'expense',
]);

interface AccountRow extends Record<string, SqlValue> {
  id: number;
  code: string;
  name: string;
  type: string;
  parent_id: number | null;
  is_system: number;
  created_at: string;
}

function rowToAccount(row: AccountRow): Account {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    type: row.type as AccountType,
    parentId: row.parent_id,
    isSystem: row.is_system === 1,
    createdAt: row.created_at,
  };
}

function validateNewAccount(input: NewAccountInput): void {
  if (!input.code || !input.code.trim()) {
    throw new ValidationError('Account code is required');
  }
  if (!input.name || !input.name.trim()) {
    throw new ValidationError('Account name is required');
  }
  if (!VALID_TYPES.has(input.type)) {
    throw new ValidationError(
      `Invalid account type "${String(input.type)}"; must be one of ${[...VALID_TYPES].join(', ')}`,
    );
  }
}

/** Creates a new account. Rejects duplicate codes (schema UNIQUE constraint is the final authority). */
export function createAccount(input: NewAccountInput): Account {
  validateNewAccount(input);
  const db = getDatabase();

  const existing = db.query<{ id: number }>('SELECT id FROM accounts WHERE code = ?', [input.code]);
  if (existing.length > 0) {
    throw new DuplicateAccountError(`Account code "${input.code}" already exists`);
  }

  try {
    db.run(`INSERT INTO accounts (code, name, type, parent_id, is_system) VALUES (?, ?, ?, ?, ?)`, [
      input.code,
      input.name,
      input.type,
      input.parentId ?? null,
      input.isSystem ? 1 : 0,
    ]);
  } catch (cause) {
    throw new DuplicateAccountError(`Account code "${input.code}" already exists`, cause);
  }

  const [row] = db.query<AccountRow>('SELECT * FROM accounts WHERE code = ?', [input.code]);
  return rowToAccount(row);
}

/** Looks up an account by id, or null if it does not exist. */
export function getAccount(id: number): Account | null {
  const db = getDatabase();
  const rows = db.query<AccountRow>('SELECT * FROM accounts WHERE id = ?', [id]);
  return rows.length > 0 ? rowToAccount(rows[0]) : null;
}

/** Lists all accounts, optionally filtered by type. */
export function listAccounts(type?: AccountType): Account[] {
  const db = getDatabase();
  const rows = type
    ? db.query<AccountRow>('SELECT * FROM accounts WHERE type = ? ORDER BY code', [type])
    : db.query<AccountRow>('SELECT * FROM accounts ORDER BY code');
  return rows.map(rowToAccount);
}

/** Finds an account by exact name (case-sensitive per schema; no fuzzy matching here). */
export function findAccountByName(name: string): Account | null {
  const db = getDatabase();
  const rows = db.query<AccountRow>('SELECT * FROM accounts WHERE name = ?', [name]);
  return rows.length > 0 ? rowToAccount(rows[0]) : null;
}
