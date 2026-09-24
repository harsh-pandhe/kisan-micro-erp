# Architecture

## Pipeline

```
Text / phone speech-to-text
        ↓
Deterministic transaction parser
        ↓
Ledger / item classification
        ↓
Voucher generation
        ↓
Double-entry accounting
        ↓
SQLite compiled to WebAssembly
        ↓
IndexedDB persistence
        ↓
Reports
        ↓
Basic cryptographic signing
```

Each arrow is a module boundary, not a suggestion. The parser never touches the
database; the UI never constructs journal entries; persistence never knows
about accounting rules. This keeps each stage independently testable
(`docs/../tests`) and lets any stage be rewritten later without touching its
neighbors.

## 1. Why there is no backend

The target user is a small farmer or trader who may have no reliable data
connection at the point of sale or purchase. A backend turns "no signal" into
"app doesn't work." Every requirement in Phase 1 — entry, classification,
posting, reports, backup — has to work standing in a field with the phone in
airplane mode. A backend also adds cost (hosting, uptime, security surface)
that a ₹30,000 Phase-1 budget cannot carry. So the app is a static PWA: all
logic runs in the browser/WebView, and the only "server" is whatever static
host serves the built assets once.

## 2. Why SQLite-WASM (sql.js)

The domain is relational and needs real guarantees: `SUM(debits) = SUM(credits)`,
foreign keys between journal lines and accounts, and ad-hoc reporting queries
(Trial Balance, P&L, Balance Sheet) that are naturally expressed in SQL rather
than hand-rolled over a document store. SQLite gives us that without a server.

Library choice: **sql.js** (`sql.js` on npm), not the newer official
`@sqlite.org/sqlite-wasm`.

- `sql.js` runs synchronously in the main thread (or a worker if we choose
  later) and exposes the whole database as an in-memory `Uint8Array`, which we
  persist ourselves to IndexedDB. This matches the pipeline in this document
  exactly: SQLite-WASM → IndexedDB persistence is an explicit, inspectable
  step, not something the library does implicitly.
- The official `@sqlite.org/sqlite-wasm` package is built around OPFS
  (Origin Private File System) and a worker-based API. OPFS support and
  behavior varies more across Android WebViews, which is our primary
  deployment target — a rural user's phone browser, not necessarily desktop
  Chrome. `sql.js`'s plain-`Uint8Array` model is the safer baseline for
  Phase 1.
- We may revisit this in a later phase if OPFS proves reliable enough on the
  target devices and multi-tab consistency becomes a requirement.

## 3. Why IndexedDB is required

`sql.js` keeps the database in memory; without persistence, a page reload
loses every transaction. IndexedDB is the only browser storage with enough
capacity and durability for a growing SQLite file (`localStorage` is capped
around 5MB and string-only). We serialize the sql.js database to bytes and
store that blob in IndexedDB (via `idb`) after each write, and reload it into
sql.js on startup — see `src/features/persistence/`.

## 4. How transaction parsing works

A deterministic rule/regex parser (`src/parser/`) reads raw text — typed, or
transcribed by the device's own speech-to-text — and extracts a normalized
transaction: verb (bought/sold/paid/received), item, quantity, unit, amount,
and counterparty, for common Hindi/Hinglish phrasings. It is deliberately
_not_ an LLM: outputs must be reproducible, auditable, and explainable to a
non-technical user, which is what "deterministic" buys us. Ambiguous input is
routed to the unknown-item classification flow rather than guessed.

## 5. How ledger classification works

Every item name resolves to a ledger account. Known items resolve via a
persistent `item_mappings` table (`src/features/ledgers/`); unknown items
prompt the user once, and the choice is remembered for next time. This is a
simple key→ledger cache, not a taxonomy engine — deliberately, for Phase 1.

## 6. How double-entry accounting works

The accounting engine (`src/features/accounting/`) turns a classified,
normalized transaction into a `journal_entries` row plus two or more
`journal_lines` rows whose debit and credit amounts are equal by
construction. Amounts are stored as integers in minor units (paise) to avoid
floating-point drift. Every voucher generator is a pure function from
(normalized transaction, chart of accounts) to a balanced journal entry, and
is unit-tested against that invariant directly — see `docs/accounting-model.md`.

## 7. How persistence works

On every mutating operation, the in-memory sql.js database is serialized and
written to IndexedDB. On app start, the last-saved bytes are loaded back into
a fresh sql.js instance. Backup/restore (Milestone 8) is the same
serialization, exported to/from a file the user controls.

## 8. How cryptographic sealing works

Financial exports (backups, reports) are hashed with SHA-256 and signed with
an Ed25519 keypair generated and kept on-device (`src/features/crypto/`,
`@noble/hashes`, `@noble/ed25519`). This lets a later reviewer verify a
specific export has not been altered since it was sealed. Phase 1 does _not_
claim hardware-backed key storage or tamper-proofing — the key lives in
IndexedDB like the rest of the app data, which is an intentional, documented
limitation (see Out of Scope below).

## 9. How the application shell and PWA work

`src/App.tsx` wraps the whole app in an error boundary and a
`react-router-dom` `HashRouter` (`/`, `/transactions`, `/accounts`,
`/reports`, `/settings`). `HashRouter` — not `BrowserRouter` — is
deliberate: this is a static, installable PWA with no server to add
history-mode rewrite rules, and hash routes always resolve correctly from
the service-worker cache while offline. `src/components/AppShell.tsx`
renders a sticky header (app name + live online/offline status), the
routed page, and a bottom tab bar that becomes a top nav bar on wider
screens. Each page under `src/pages/` is currently a placeholder built
from shared primitives in `src/components/` (`Button`, `Card`, `Input`,
`PageHeader`, `EmptyState`, `StatusBadge`) — no accounting logic lives in
the UI layer, consistent with the pipeline boundary at the top of this
document.

Installability and offline shell loading come from `vite-plugin-pwa`
(Workbox `generateSW`, configured in `vite.config.ts`): it emits a web
manifest and a service worker that precaches every built asset, so the
shell opens with no network after the first load. See
`docs/milestone-1.md` for what was built and verified in that milestone,
and its stated limitations.

## 10. What is intentionally excluded from Phase 1

CRDT/multi-device sync, Bluetooth/WebRTC transfer, an FPO master database,
automated depreciation, general NLP-scale language understanding, any cloud
backend (Firebase/Postgres/MySQL/Express/Next API routes), user accounts,
enterprise security certification, hardware-backed key storage, full Tally
compatibility, and full GST. These are real Phase-2+ concerns; building them
now would blow the Phase-1 budget and timeline without a working core to
build them on top of.
