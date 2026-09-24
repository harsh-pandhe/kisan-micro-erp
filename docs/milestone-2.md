# Milestone 2: SQLite-WASM + IndexedDB Persistence

This milestone adds the local-database foundation the app runs on: a
SQLite database compiled to WebAssembly (`sql.js`), applied schema, and a
byte-level persistence round trip through IndexedDB. No accounting logic,
UI forms, parser, reports, or crypto/backup UX are part of this milestone
— see "What remains" below.

## Architecture

```
sql.js (WASM SQLite, in-memory)
   ↕ export()/new Database(bytes)
IndexedDB (via idb) — one object store, one blob key
```

`src/db/database.ts` is the only module that touches `sql.js` directly.
Everything else in the app is meant to go through the small typed
`AppDatabase` surface it exposes (`run`, `query`, `export`) — no raw SQL
scattered through React components, and the parser/accounting layers
(Milestone 3+) stay DB-independent by construction.

### Why sql.js (recap, see `docs/architecture.md` §2 for the full rationale)

`sql.js` runs synchronously in the main thread and hands back the whole
database as a `Uint8Array`, which this milestone persists explicitly to
IndexedDB. That matches the documented pipeline (SQLite-WASM →
IndexedDB persistence as an inspectable step) and avoids OPFS, whose
Android WebView support is inconsistent — the deployment target for this
app.

### WASM asset loading

`sql.js`'s `.wasm` binary is copied into `public/sql-wasm.wasm` (from
`node_modules/sql.js/dist/sql-wasm.wasm`) so Vite serves it as a plain
static asset at `/sql-wasm.wasm`, and `vite-plugin-pwa`'s
`globPatterns` (already including `wasm` from Milestone 1) precaches it
alongside the rest of the shell — confirmed in the production build (see
"Browser/build verification" below). `initSqlJs({ locateFile })` in
`src/db/database.ts` resolves to `${BASE_URL}sql-wasm.wasm` at runtime.
Under Vitest the same function resolves to the package's own copy on
disk instead (`./node_modules/sql.js/dist/${file}`), since sql.js
detects the Node test runner and reads it via `fs` rather than `fetch`
— this only ever executes under `import.meta.env.MODE === 'test'`, never
in the shipped app.

## DB init lifecycle

`src/db/database.ts` exposes:

- `initializeDatabase(): Promise<AppDatabase>` — idempotent; concurrent
  callers share one in-flight promise (`initPromise`) instead of racing
  to create two sql.js instances. On first run it creates a fresh
  in-memory `sql.js` `Database` and applies the schema; on later runs it
  restores the last-persisted bytes from IndexedDB and re-applies the
  schema (idempotent `CREATE TABLE IF NOT EXISTS`, safe on top of
  existing data).
- `getDatabase(): AppDatabase` — returns the already-initialized
  instance, or throws if called before `initializeDatabase()` resolved.
- `persistDatabase(): Promise<void>` — serializes the current in-memory
  DB (`db.export()`) and writes the whole blob to IndexedDB. Always the
  full DB, never individual tables/rows.
- `closeDatabase()` — closes the sql.js connection and clears module
  state (used between tests, and available for a future explicit
  teardown path).

`src/App.tsx` calls `initializeDatabase()` once on mount, tracks a
`'loading' | 'ready' | 'error'` state, and blocks rendering the routed
app with a minimal `EmptyState` (reusing the existing component, no new
loading UI system) until it resolves. This is intentionally the whole
of Milestone 2's UI footprint.

## Schema

Applied from `src/db/schema.ts` (`SCHEMA_SQL`, unchanged from what was
already scaffolded going into this milestone — see
`docs/database-schema.md` for full column-by-column rationale):
`accounts`, `journal_entries`, `journal_lines`, `transactions`,
`item_mappings`, `settings`, plus supporting indexes.
`PRAGMA foreign_keys = ON` is set before the schema is applied, and
again implicitly on every restore. Money is `amount_minor INTEGER NOT
NULL CHECK (amount_minor > 0)` — positive integer minor units, never a
float. `journal_lines.account_id` / `journal_entry_id` are real
`REFERENCES`, so orphaned lines are constraint violations, not silent
bugs. `docs/database-schema.md` was already accurate and needed no
changes for this milestone.

## IndexedDB persistence flow

`src/db/persistence.ts` wraps `idb` around one database
(`kisan-micro-erp`) with a single object store (`sqlite`) and a single
fixed key (`main`) — there is exactly one SQLite blob per install.
`loadPersistedBytes()` returns `null` on first run (no record yet);
`savePersistedBytes(bytes)` replaces the record wholesale. The `idb`
connection itself is opened once and cached, matching the "init exactly
once" pattern used for sql.js.

## Failure handling

Handled explicitly, each surfaced as a typed `DatabaseError` with a
`kind`:

- **WASM init failure** (`wasm-init-failed`) — `initSqlJs()` rejection is
  caught and wrapped; `sqlJsPromise` is reset so a later call can retry.
- **IndexedDB unavailable** (`indexeddb-unavailable`) — a failure reading
  or writing IndexedDB (private browsing, storage disabled, quota) is
  caught at both `initializeDatabase()` and `persistDatabase()` and
  reported distinctly from a WASM failure.
- **Corrupted persisted bytes** (`corrupted-bytes`) — restoring bytes
  that fail to open as a `sql.js` `Database`, or open but fail a real
  `sqlite_master` query, throws before anything is written back.
  Critically, **nothing is persisted or overwritten** on this path — the
  bytes already in IndexedDB are left exactly as they were, so a
  corrupted blob doesn't get silently replaced (and its recovery
  potential destroyed) by a fresh empty database.
- **Schema init failure** (`schema-init-failed`) — a failure applying
  `SCHEMA_SQL` (fresh DB or on top of restored bytes) is caught and
  wrapped separately from the above.

`initializeDatabase()`'s `initPromise` is cleared on any failure so a
later retry (e.g. the user reloading after fixing storage permissions)
gets a fresh attempt rather than being permanently wedged on the first
error. `App.tsx` surfaces all of the above uniformly as a "Database
unavailable" state with a reload action; it does not need to
distinguish `DatabaseError.kind` today, but the typed error preserves
that information for later, more specific UX.

## How persistence was tested

`tests/db/persistence.test.ts` is a real (non-mocked) round trip: it
creates an actual `sql.js` `Database`, applies the real schema, inserts
deterministic rows, `export()`s it, writes the bytes through
`savePersistedBytes()` into a **real IndexedDB implementation**
(`fake-indexeddb`, added as a dev dependency — jsdom itself has no
IndexedDB), reads them back with `loadPersistedBytes()`, builds a
**second, independent** `sql.js` `Database` from only those restored
bytes, and asserts the queried rows match exactly.

`tests/db/database.test.ts` does the same round trip through the public
lifecycle API (`initializeDatabase` → mutate → `persistDatabase` →
`closeDatabase` → `initializeDatabase` again) to prove the app-facing
surface, not just the underlying primitives, survives a simulated app
restart. It also asserts `initializeDatabase()` is safe under concurrent
calls (three parallel calls resolve to the same instance) and that
`getDatabase()` throws before initialization.

## Schema/constraint tests

`tests/db/constraints.test.ts` (in addition to the pre-existing
`tests/schema.test.ts`) verifies, against a real `sql.js` database:

- every core table exists with its expected columns (`PRAGMA
table_info`)
- `PRAGMA foreign_keys` is on
- money round-trips as an integer, not a float
- a negative `amount_minor` is rejected (CHECK)
- a zero `amount_minor` is rejected (CHECK)
- a `journal_lines.account_id` pointing at a non-existent account is
  rejected (FK violation)
- an invalid `accounts.type` is rejected (CHECK)
- an invalid `journal_lines.side` is rejected (CHECK)
- a duplicate `journal_entries.voucher_number` is rejected (UNIQUE)

## Browser/build verification

- `npm run build` (`tsc -b && vite build`) succeeds; `dist/sql-wasm.wasm`
  is emitted and `dist/sw.js`'s precache manifest includes it.
- `npm run preview` was started and `curl` confirmed both `/` (200) and
  `/sql-wasm.wasm` (200, `Content-Type: application/wasm`,
  `Content-Length: 658410`) are served correctly from the production
  build.

## What remains for Milestone 3

Everything explicitly out of scope here: the deterministic
Hindi/Hinglish transaction parser, item→ledger classification and
self-learning mappings, the double-entry accounting/posting engine,
Trial Balance/P&L/Balance Sheet reports, transaction entry UI, SHA-256 +
Ed25519 signing, and backup/export/import UX. This milestone only
guarantees that whatever those layers write via the `AppDatabase` API
will still be there after a reload.
