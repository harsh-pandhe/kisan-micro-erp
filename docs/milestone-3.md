# Milestone 3: Double-Entry Accounting Engine

This milestone adds the accounting domain/engine layer on top of the
Milestone 2 SQLite-WASM/IndexedDB persistence layer. It implements the
`src/features/accounting/` module and its tests. It does **not** implement
transaction-entry UI, the Hindi/Hinglish parser, voice input,
classification/self-learning, reports (Trial Balance/P&L/Balance Sheet),
crypto, backup/restore, or sync — those are later milestones.

## Architecture boundary

```
UI / Parser (future)
      |
      v
Domain command (structured input: accountId, side, amountMinor, ...)
      |
      v
Accounting service (src/features/accounting/*)
      |
      v
postJournalEntry()  -- validates, then atomically inserts
      |
      v
SQLite (via src/db's AppDatabase.run/query, inside BEGIN/COMMIT)
      |
      v
persistDatabase() -- only after a successful commit
```

**Rule:** neither the UI nor the (future) parser may ever `INSERT` into
`journal_entries` or `journal_lines` directly. Every write to those tables
must go through `postJournalEntry()` (or a business-operation helper in
`operations.ts` that calls it). This module never imports React and has no
UI dependency; it only imports `src/db`'s `AppDatabase` surface
(`getDatabase()`, `persistDatabase()`), reusing the Milestone 2 lifecycle
(`initializeDatabase()`/`closeDatabase()`) as-is.

## Module layout (`src/features/accounting/`)

- `types.ts` — `Account`, `JournalEntry`, `JournalLine`, `NewJournalEntry`,
  etc., mirroring `src/db/schema.ts` exactly.
- `errors.ts` — typed error hierarchy (`ValidationError`,
  `AccountNotFoundError`, `DuplicateAccountError`, `DuplicateVoucherError`,
  `UnbalancedEntryError`, `AccountingDatabaseError`), all extending a base
  `AccountingError` with a `kind` discriminant, so callers can branch on
  failure kind instead of parsing raw SQLite error text.
- `accounts.ts` — chart-of-accounts CRUD: `createAccount`, `getAccount`,
  `listAccounts`, `findAccountByName`.
- `validation.ts` — pure, DB-free structural validation
  (`validateJournalEntry`) and the balancing check (`assertBalanced`).
- `voucher.ts` — deterministic voucher-number generation
  (`generateVoucherNumber`).
- `posting.ts` — `postJournalEntry()`, the only writer of
  `journal_entries`/`journal_lines`.
- `journal.ts` — read-only queries: `getJournalEntry`, `listJournalEntries`,
  `getJournalLines`, `getAccountBalance`, `getAllAccounts`.
- `operations.ts` — thin business-operation helpers (`postPurchase`,
  `postSale`, `postPayment`, `postReceipt`) that build a two-line balanced
  entry and post it; see `docs/accounting-model.md` for the convention.
- `index.ts` — barrel export.

## Account model

Account types are exactly the schema's `accounts.type` enum: `asset`,
`liability`, `equity`, `income`, `expense`. `createAccount` validates a
required name, a valid type, and rejects a duplicate `code` (the schema's
`UNIQUE` constraint on `accounts.code` is the final authority; the app-level
check is a courtesy for a clean error, not a replacement).

## Journal-entry model and debit/credit representation

A journal entry has an id, `voucherType`, `voucherNumber`, `date`,
`narration`, optional `sourceTransactionId`, and a list of lines. Each line
has an `accountId`, a `side` (`'debit' | 'credit'` — an indicator, never a
signed amount), and a positive integer `amountMinor` (minor currency units,
e.g. paise). Money is never represented as a float anywhere in this module.
This preserves the schema's existing representation exactly
(`journal_lines.side` + `amount_minor > 0`).

## Balancing invariant

For every entry, `sum(amountMinor where side='debit') ===
sum(amountMinor where side='credit')`, checked by `assertBalanced()` before
any SQL runs. `validateJournalEntry()` also rejects: fewer than two lines
(including single-line and empty entries), zero/negative amounts,
non-integer amounts, missing/non-positive account ids, and malformed side
values. Application-level validation is in addition to, not instead of, the
schema's `CHECK` constraints — both layers hold independently.

## Atomic posting and rollback

`postJournalEntry(entry)`:

1. `validateJournalEntry(entry)` — structure + balance, no DB access.
2. For every line, confirm the referenced account exists (`SELECT ... WHERE
id = ?`); a missing account throws `AccountNotFoundError` immediately, with
   nothing written. The engine never auto-creates a missing account.
3. Resolve a voucher number (caller-supplied, or generated).
4. `db.run('BEGIN')`, insert the `journal_entries` row, insert each
   `journal_lines` row, `db.run('COMMIT')`. Any exception in this block
   triggers `db.run('ROLLBACK')` before the error is re-thrown (wrapped as
   `DuplicateVoucherError` for a `UNIQUE` violation on `voucher_number`, or
   `AccountingDatabaseError` otherwise).
5. Only after a successful `COMMIT` does it call `persistDatabase()`
   (Milestone 2's IndexedDB write). A failed or rolled-back entry never
   calls `persistDatabase()` and leaves no partial rows in memory.

This uses sql.js's real `BEGIN`/`COMMIT`/`ROLLBACK` support on the shared
connection — not independent writes wrapped in a try/catch.

## Voucher-number handling

`generateVoucherNumber(voucherType, date)` produces
`<PREFIX>-<YYYYMMDD>-<seq>` (e.g. `SAL-20260101-0001`), where `seq` is a
count of existing vouchers of that type/date plus one. This is a
best-effort, non-atomic generator; the database's `UNIQUE` constraint on
`voucher_number` is the final authority. A collision (generated or
caller-supplied) is surfaced as a clean `DuplicateVoucherError` rejection
with a full rollback — never a partially-persisted record.

## Account balance calculation

`getAccountBalance(accountId)` sums `amount_minor` per side for that
account and returns a signed integer in minor units, interpreted per the
account's normal balance side:

- **Debit-normal** (Assets, Expenses): `balance = debitTotal - creditTotal`.
- **Credit-normal** (Liabilities, Equity, Income): `balance = creditTotal -
debitTotal`.

A positive result means a balance on the account's normal side. This is
deterministic and reproducible from the same `journal_lines` rows; no
report-building (Trial Balance/P&L/Balance Sheet) is implemented — these are
primitives for a later milestone.

## Test coverage

`tests/accounting/`:

- `accounts.test.ts` — valid asset/expense/income account creation, invalid
  type rejection, duplicate code rejection, listing/filtering, lookup by
  name.
- `journal.test.ts` — pure structural validation: valid 2-line and
  multi-line entries, zero/negative/float amounts, missing account id,
  malformed side, single-line and empty entries, unbalanced vs. balanced
  entries, invalid voucher type.
- `posting.test.ts` — real sql.js posting: balanced debit=credit posting
  and re-read, rejection before any DB write for unbalanced/single-line
  entries, rollback with no partial rows for a nonexistent account
  reference, no auto-account-creation, duplicate voucher number leaving the
  first posting intact, sequential voucher-number generation.
- `balance.test.ts` — debit-normal vs. credit-normal balance calculation
  across asset/income/expense/equity accounts, determinism, the
  debit=credit invariant on every successful posting, and a full
  close/restore-through-IndexedDB persistence round trip for a posted
  entry.

All tests use the real sql.js implementation and `fake-indexeddb`, following
the pattern established in `tests/db/*.test.ts` — no mocked SQL.

## Persistence integration

`persistDatabase()` (Milestone 2) is called exactly once per successful
`postJournalEntry()` call, after `COMMIT`, and is never called on a
validation failure, missing-account rejection, duplicate-voucher rejection,
or any other error path that triggers `ROLLBACK`. Verified in
`posting.test.ts` (rollback cases assert no rows exist) and
`balance.test.ts` (persistence round-trip test).

## What is deliberately not implemented yet

- Transaction-entry UI, forms, or any React components for accounting.
- The Hindi/Hinglish natural-language parser and voice input.
- Classification / self-learning for item→account mapping.
- Reports: Trial Balance, Profit & Loss, Balance Sheet.
- Crypto, backup/restore, and sync.

These remain scoped to later milestones per `docs/development-roadmap.md`.
