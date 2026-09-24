/**
 * SQLite schema for Phase 1. Applied to a fresh sql.js database on first
 * run; see docs/database-schema.md for rationale and docs/architecture.md
 * for why SQLite-WASM + IndexedDB was chosen over alternatives.
 */
export const SCHEMA_VERSION = 1;

export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  parent_id INTEGER REFERENCES accounts(id),
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  voucher_type TEXT NOT NULL CHECK (voucher_type IN ('purchase','sale','payment','receipt','journal')),
  voucher_number TEXT NOT NULL UNIQUE,
  date TEXT NOT NULL,
  narration TEXT,
  source_transaction_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journal_entry_id INTEGER NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  side TEXT NOT NULL CHECK (side IN ('debit','credit')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  narration TEXT
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  raw_text TEXT NOT NULL,
  input_method TEXT NOT NULL CHECK (input_method IN ('text','speech')),
  parsed_at TEXT,
  journal_entry_id INTEGER REFERENCES journal_entries(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','parsed','needs_classification','posted','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS item_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name_normalized TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journal_lines(account_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date ON journal_entries(date);
`;
