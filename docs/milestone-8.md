# Milestone 8 — Local Backup & Restore

Scope: a complete, local, offline export of the SQLite database to a
downloadable file, and validated, atomic import of one back in. No
cryptographic signing, no cloud storage, no scheduling, no sync — those are
explicitly out of scope (see "Deferred" below).

## Format decision

**A backup is a real, standalone SQLite file** — the exact bytes `db.export()`
produces, with one addition: a `backup_format_version` row written into the
file's own `settings` table (key `backup_format_version`, value `"1"`).

No separate wrapper envelope (no JSON+base64, no custom binary header) was
introduced. Reasons:

- The SQLite byte stream is already self-describing and already the single
  source of truth for the app (per `docs/architecture.md`); wrapping it in
  another format would mean maintaining two serializations of "the same
  thing" for no benefit.
- SQLite has its own robust format detection and integrity tooling
  (`PRAGMA integrity_check`, `PRAGMA foreign_key_check`) that a custom
  envelope cannot improve on.
- A plain `.sqlite` file is directly openable by any SQLite browser/CLI for
  debugging or manual recovery, which a bespoke wrapper would prevent.

**Filename convention:** `kisan-micro-erp-backup-<ISO-timestamp>.sqlite`,
e.g. `kisan-micro-erp-backup-20260924T101530.sqlite`. Colons and the
trailing `Z` are stripped from the ISO string so the name is safe on every
filesystem, and the timestamp keeps backups sortable by name.

**Compatibility marker:** `PRAGMA user_version` was considered but rejected
in favor of a `settings` table row, because `settings` already exists as
the app's key/value store (per `docs/database-schema.md`) and using it
keeps the marker visible to ordinary `SELECT` tooling instead of a
SQLite-specific pragma that's easy to overlook.

`BACKUP_FORMAT_VERSION = 1` (`src/features/backup/types.ts`) is bumped only
when the backup's compatibility contract changes (e.g. a schema change that
requires new validation rules). A backup whose stamped version is **newer**
than the running app's `BACKUP_FORMAT_VERSION` is rejected outright — this
app never guesses at or auto-migrates an unrecognized future format.

## Export (`src/features/backup/export.ts`)

`exportDatabase()`:

1. Calls the M2 singleton's `getDatabase().export()` to get the live
   in-memory database's bytes. `export()` is a pure read — it does not
   mutate the live sql.js instance.
2. Opens those bytes in a **throwaway** sql.js `Database` (via
   `loadSqlJsModule()`, the same sql.js loader M2 uses) and stamps
   `backup_format_version` into _that_ instance's `settings` table.
3. Exports the throwaway instance's bytes and discards it.

Because the stamping happens on a disposable copy, the live database's
`settings` table is never written to by export, and export never calls
`persistDatabase()` — nothing reaches IndexedDB. This is verified by
`tests/backup/export.test.ts` (before/after byte-equality of the live DB,
and an explicit check that `loadPersistedBytes()` stays `null`).

`downloadBackup()` wraps the bytes in a `Blob` (`application/x-sqlite3`),
creates an object URL, and clicks a temporary `<a download>` anchor — the
standard client-side browser download pattern. No network request is
involved. The Settings page only calls `exportDatabase()` +
`downloadBackup()`; it contains no SQL.

## Validation (`src/features/backup/validate.ts`, `import.ts`)

The imported file is treated as **fully untrusted input** end to end:

1. `readBackupFile(file)` reads the browser `File` into raw bytes via
   `File.arrayBuffer()` — no parsing yet.
2. `openCandidateDatabase()` opens those bytes in a **new, unattached**
   sql.js `Database` (never the live singleton). An empty file, or bytes
   sql.js cannot open at all, are rejected immediately as `BackupError`
   (`empty-file` / `unreadable`).
3. `validateCandidateDatabase()` runs, in order, against that isolated
   instance only:
   - `PRAGMA integrity_check;` — must return exactly `ok`.
   - `PRAGMA foreign_key_check;` — must return zero rows.
   - Presence of every core table (`accounts`, `journal_entries`,
     `journal_lines`, `transactions`, `item_mappings`, `settings` — the
     same list as `src/db/schema.ts`).
   - The `backup_format_version` marker in `settings`: must exist, must be
     an integer, and must be `<= BACKUP_FORMAT_VERSION`.
4. Any failure throws a typed `BackupError` with a specific `kind`
   (`integrity-check-failed`, `foreign-key-violation`, `missing-tables`,
   `unsupported-version`, …) and the temporary instance is closed. **No
   step ever attempts to repair, patch, or auto-migrate** a bad file —
   rejection is always explicit and total.

`validateBackup(bytes)` composes steps 2–3 for callers (e.g. the Settings
UI) that want to validate before committing to a restore.

## Atomic restore (`src/features/backup/import.ts`, `src/db/database.ts`)

`restoreDatabase(bytes)`:

1. Opens a fresh temporary sql.js instance from `bytes` and re-runs full
   validation from scratch (it never trusts a caller's earlier
   `validateBackup()` result).
2. **Only if every check passes**, it calls the new `replaceDatabase()`
   primitive added to `src/db/database.ts`, which:
   - Wraps the validated temporary connection as the new `AppDatabase`.
   - Points the module's `appDb` singleton at it, and resets `initPromise`
     to an already-resolved promise for it, so every subsequent
     `getDatabase()` / `initializeDatabase()` call anywhere in the app
     (accounting, transactions, classification, reports) sees the restored
     data with no special-casing.
   - Closes the _previous_ sql.js connection so no stale reference or
     leaked WASM memory survives the swap.
3. Calls the existing `persistDatabase()` (M2) to write the new state to
   IndexedDB.

If validation fails at step 1, the temporary instance is closed and
discarded, `replaceDatabase()` is never called, and the function throws —
**the active database and its IndexedDB bytes are completely untouched**.
This is the scenario `tests/backup/restore.test.ts` exercises directly: it
seeds a known transaction, attempts a corrupted and then a
future-format-version restore, and asserts the active DB instance, its
data, and the previously-persisted IndexedDB bytes are all unchanged
afterwards (re-verified by loading a fresh instance straight from
IndexedDB).

If validation passes and the swap succeeds but `persistDatabase()` itself
then fails (e.g. IndexedDB briefly unavailable), the function throws a
`BackupError` with kind `persist-failed`: the running app already has the
restored data in memory, but the caller is told the IndexedDB write did
not happen so it can retry persisting rather than assume success silently.

## Settings UI (`src/components/BackupRestore.tsx`)

Explicit states: `idle → exporting/validating → ready_to_restore →
restoring → success/error`. The restore flow requires an explicit
confirmation step ("You are about to replace the current local database
with this backup... [Cancel] [Restore Backup]") before `restoreDatabase()`
is ever called, and the restore control is disabled while a restore is
in flight to prevent duplicate restores. The component only calls the
typed functions exported from `src/features/backup` — it contains no SQL
of any kind, matching the rest of the app's UI/data boundary.

## Cross-feature consistency after restore

Accounts (M6), transaction history (M6) and reports (M7) all read through
`getDatabase()` at call time, so once `replaceDatabase()` swaps the
singleton they automatically see the restored data with no changes to
those modules (verified by `tests/backup/round-trip.test.ts`, which
restores DB A over DB B and then calls `getAllAccounts()`,
`listTransactionHistory()`, `getTrialBalance()` and `classify()` directly
against the restored state).

What _does_ need a fix is React pages that cache query results in
`useState` on mount and never re-fetch. After a successful restore, the
Settings page dispatches a `window` `CustomEvent`
(`kisan:backup-restored`, exported as `BACKUP_RESTORED_EVENT`) via
`notifyBackupRestored()`. `AccountsPage`, `TransactionsPage`, and
`ReportsPage` each add a listener in a `useEffect` that re-runs their
existing refresh logic (or, for `ReportsPage`'s `useMemo`-based reports, an
extra `dataVersion` state value that forces the memoized reports to
re-query) — no new state-management library, just the existing
refresh/fetch functions triggered again.

## IndexedDB integration & offline guarantees

Export never touches IndexedDB. Restore only writes to IndexedDB through
the existing `persistDatabase()` (M2), after the swap has already
succeeded. Both directions use only browser-native `File`/`Blob`/anchor
APIs and `idb` (already used by M2) — grepping `src/features/backup` for
`fetch`, `XMLHttpRequest`, or any cloud SDK returns nothing. The whole
milestone works with the device fully offline.

## Limitations & what's deferred

- **No cryptographic authenticity guarantee.** A backup file is a plain
  local file with no signature, hash, or encryption. A determined actor
  with filesystem access could hand-edit the SQLite bytes (e.g. change an
  amount) and, as long as the result still passes `integrity_check` /
  `foreign_key_check` / table-presence / version checks, it would be
  accepted as valid. Detecting or preventing that is explicitly
  **Milestone 9's** job (signing with the `@noble/ed25519`/`@noble/hashes`
  dependencies already present in `package.json` for that future work) —
  it is intentionally not attempted here.
  **Update:** Milestone 9 has now implemented this — see
  `docs/milestone-9.md`. Restore now also supports signed `.kmesig`
  backups (crypto-verified, then run through this milestone's SQLite
  validation) alongside the unsigned `.sqlite` backups described above,
  which remain fully supported and unchanged.
- Deferred, not built here: cloud backup destinations (Google Drive,
  Dropbox, OneDrive, S3, Firebase, Supabase, …), automatic/scheduled
  backups, CRDT-based or any multi-device sync.
- A backup captures the entire database as of the moment `export()` runs;
  there is no incremental/partial backup or restore.
