# Review-1 Evidence — Phase 1 (Milestones 1-10)

This is the Milestone 10 audit record: what was actually checked (code
read, tests run) as of 2026-09-25, not a restatement of earlier milestone
reports. Every status label below reflects direct verification done during
this audit. Labels used:

- **VERIFIED-AUTOMATED** — an automated test in this repo asserts it, and
  that test was run during this audit.
- **MANUAL-VERIFIED** — checked by reading the actual source in this audit
  (no automated test covers it, or the test only partially covers it).
- **NOT-VERIFIED-IN-SANDBOX** — cannot be checked in this headless
  container (needs a real browser/device); a documented manual procedure
  exists instead (see `docs/manual-qa-checklist.md`).
- **DEFERRED** — intentionally out of Phase 1 scope.
- **NOT-APPLICABLE** — does not apply to this project.

## Requirements traceability matrix

| Requirement/Claim                                                                | Implementation location                                  | Automated test evidence                                                                                                                                                         | Manual verification evidence                                                                                                                                                                                                                               | Status                                                                    | Known limitation                                                                              |
| -------------------------------------------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Fully client-side execution, no backend                                          | Whole `src/` tree                                        | `tests/integration/phase1-regression.test.ts` exercises the full chain with no network mocks                                                                                    | Grepped `src/` for `fetch(`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `axios` — zero hits outside comments                                                                                                                                            | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | `SpeechRecognition` (M6) is a browser API, not an app backend — see "Browser APIs used" below |
| SQLite-WASM                                                                      | `src/db/database.ts` (`loadSqlJsModule`, `locateFile`)   | `tests/db/database.test.ts`, `tests/db/constraints.test.ts`                                                                                                                     | Re-ran `npm run build`; `dist/` contains `sql-wasm.wasm`                                                                                                                                                                                                   | VERIFIED-AUTOMATED                                                        | `locateFile` production path re-confirmed via build, not a real deployed-origin fetch         |
| IndexedDB persistence                                                            | `src/db/persistence.ts`                                  | `tests/db/persistence.test.ts`, `tests/features/transactions/workflow.test.ts` (close+reopen), `tests/integration/large-fixture.test.ts`                                        | Read `persistence.ts` and `database.ts`: commit-then-persist and validate-then-replace-then-persist patterns confirmed in code                                                                                                                             | VERIFIED-AUTOMATED                                                        | Uses `fake-indexeddb` in Node; real-browser IndexedDB quota behavior not exercised here       |
| Deterministic parser                                                             | `src/parser/`                                            | `tests/parser/*.test.ts` (incl. repeated-parse determinism)                                                                                                                     | Grepped `src/parser` for `db`/`react` imports and module-scope mutable `let` — none found (all `let` are function-local)                                                                                                                                   | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| Self-learning classification                                                     | `src/features/classification/`                           | `tests/classification/*.test.ts`                                                                                                                                                | Grepped `src/features/classification` for `postJournalEntry`/`createPurchase`/`createSale`/`createPayment`/`createReceipt` — zero hits                                                                                                                     | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| Double-entry accounting, balanced postings                                       | `src/features/accounting/posting.ts`, `journal.ts`       | `tests/accounting/posting.test.ts`, `tests/accounting/journal.test.ts`, `tests/integration/phase1-regression.test.ts`, `tests/integration/large-fixture.test.ts` (120 postings) | Read `posting.ts`: atomic BEGIN/COMMIT/ROLLBACK, integer minor-unit amounts only, `persistDatabase()` only after COMMIT                                                                                                                                    | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| Trial Balance                                                                    | `src/features/reports/trial-balance.ts`                  | `tests/reports/trial-balance.test.ts`, `tests/reports/invariants.test.ts`                                                                                                       | Confirmed it reads only `journal_lines`/`journal_entries`, no direct `transactions` table query                                                                                                                                                            | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| P&L                                                                              | `src/features/reports/profit-loss.ts`                    | `tests/reports/profit-loss.test.ts`, `tests/reports/invariants.test.ts`                                                                                                         | Same derivation check as above                                                                                                                                                                                                                             | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| Balance Sheet                                                                    | `src/features/reports/balance-sheet.ts`                  | `tests/reports/balance-sheet.test.ts`, `tests/reports/invariants.test.ts`                                                                                                       | Assets = liabilities + equity re-confirmed in `phase1-regression.test.ts` and `large-fixture.test.ts`                                                                                                                                                      | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| SHA-256                                                                          | `src/features/crypto/hash.ts`                            | `tests/crypto/hash.test.ts` — independently-known NIST test vectors (empty string, "abc"), not self-consistency only                                                            | VERIFIED-AUTOMATED                                                                                                                                                                                                                                         | —                                                                         |
| Ed25519                                                                          | `src/features/crypto/sign.ts`, `verify.ts`               | `tests/crypto/sign.test.ts` — RFC 8032 TEST 1 known vector, `tests/crypto/verify.test.ts`                                                                                       | Read `sign.ts`: signs a canonical metadata+hash payload, never the raw SQLite bytes directly                                                                                                                                                               | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| Signed backup (embedded SHA-256 matches payload; Ed25519 over canonical payload) | `src/features/crypto/payload.ts`, `sign.ts`              | `tests/backup/signed-export.test.ts`, `tests/backup/signed-restore.test.ts`, `tests/backup/tamper.test.ts`                                                                      | Re-read `sign.ts`/`import.ts`: digest = `sha256Bytes(sqliteBytes)`; restore order is envelope parse -> crypto verify -> SQLite open -> `validateCandidateDatabase` -> `replaceDatabase` -> `persistDatabase`, confirmed by reading `restoreSignedDatabase` | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| Unsigned backup                                                                  | `src/features/backup/export.ts`, `import.ts`             | `tests/backup/export.test.ts`, `tests/backup/round-trip.test.ts`, `tests/backup/restore.test.ts`                                                                                | —                                                                                                                                                                                                                                                          | VERIFIED-AUTOMATED                                                        | —                                                                                             |
| Offline operation                                                                | Whole app (no network calls)                             | `tests/integration/phase1-regression.test.ts` runs the full chain with zero network access available in the test environment                                                    | Documented DevTools/airplane-mode procedure below — **not executed in a real browser in this sandbox**                                                                                                                                                     | VERIFIED-AUTOMATED (chain) / NOT-VERIFIED-IN-SANDBOX (real airplane mode) | See manual QA checklist                                                                       |
| PWA installability                                                               | `vite.config.ts` (`vite-plugin-pwa`), `public/` manifest | `npm run build` produces `dist/manifest.webmanifest` and a service worker                                                                                                       | Read generated manifest: `name`, icons, `start_url`, `display: standalone` present                                                                                                                                                                         | MANUAL-VERIFIED                                                           | Actual install prompt / Lighthouse audit needs a real browser — NOT-VERIFIED-IN-SANDBOX       |
| Restore safety (verify before activate, rollback on failure)                     | `src/features/backup/import.ts`                          | `tests/backup/restore.test.ts`, `tests/backup/tamper.test.ts`                                                                                                                   | Read `restoreDatabase`/`restoreSignedDatabase`: active DB is never touched until all validation passes                                                                                                                                                     | VERIFIED-AUTOMATED + MANUAL-VERIFIED                                      | —                                                                                             |
| Data integrity (`PRAGMA integrity_check`, `foreign_key_check`)                   | `src/features/backup/validate.ts`                        | `tests/backup/validation.test.ts`, extended by `tests/integration/large-fixture.test.ts` (120-row fixture)                                                                      | —                                                                                                                                                                                                                                                          | VERIFIED-AUTOMATED                                                        | —                                                                                             |
| Performance/memory measurement                                                   | —                                                        | `tests/integration/performance.test.ts` — real `performance.now()` timings, printed and asserted with loose sanity bounds only                                                  | See "Performance measurements" below                                                                                                                                                                                                                       | VERIFIED-AUTOMATED (Node/Vitest timings only)                             | Real-device/browser memory profiling NOT-VERIFIED-IN-SANDBOX — see procedure below            |

## Category breakdown

**(A) Architecture** — client-only, browser execution, SQLite-WASM,
IndexedDB. VERIFIED-AUTOMATED + MANUAL-VERIFIED (see matrix rows above).
No server code, API route, or cloud SDK exists anywhere in `src/`
(confirmed by grep in Step 27/28 of this audit).

**(B) Deterministic input** — parser grammar, ambiguous/invalid handling.
VERIFIED-AUTOMATED via `tests/parser/*`, including
`tests/parser/invalid-input.test.ts` for unsupported/ambiguous input and
`tests/integration/phase1-regression.test.ts`'s negative-path test (a
failed parse produces zero journal rows and never appears in reports).

**(C) Learning** — persisted mappings, explicit learning, deterministic
lookup. VERIFIED-AUTOMATED via `tests/classification/*`. Mappings are
persisted only via SQLite (`src/features/classification/mappings.ts`);
learning is explicit (`learnMapping`), never automatic; no account is ever
auto-created by the classifier (confirmed by reading `classify.ts` and
`learning.ts` — neither calls any account-creation or posting function).

**(D) Accounting** — double-entry, balanced postings, three reports.
VERIFIED-AUTOMATED + MANUAL-VERIFIED (see matrix). The Step-11 canonical
integration test (`tests/integration/phase1-regression.test.ts`) and the
Step-20 large-fixture test (`tests/integration/large-fixture.test.ts`,
120 transactions) both assert the debit=credit and
assets=liabilities+equity invariants hold end-to-end, not just in
isolated unit tests.

**(E) Security** — SHA-256, Ed25519, key storage, signed backup,
verify-before-restore. VERIFIED-AUTOMATED via independently-known test
vectors (`tests/crypto/hash.test.ts`, `tests/crypto/sign.test.ts`) plus
the full tamper matrix (`tests/backup/tamper.test.ts`). Private key
storage: MANUAL-VERIFIED by grep — the private key never appears in
`localStorage`, the SQLite DB, an exported backup (signed or unsigned),
or any `console.log`/`console.error` call anywhere in
`src/features/crypto` or `src/features/backup` (only two `console.error`
calls exist in the whole app, in `ErrorBoundary.tsx` and `App.tsx`,
logging an `Error` object with no key/financial-amount payload). Ed25519
proves control of a locally-generated key, not real-world identity — this
is stated in `src/features/crypto/README.md` and `docs/milestone-9.md`.

**(F) Offline operation** — no backend, PWA, IndexedDB. See matrix rows
above. The zero-network claim is VERIFIED-AUTOMATED at the code-path level
(no network API is even reachable in the test environment) and
MANUAL-VERIFIED by grep; the real-browser airplane-mode/DevTools
demonstration is NOT-VERIFIED-IN-SANDBOX — see the procedure below and in
`docs/manual-qa-checklist.md`.

**(G) Evidence** — automated tests, manual QA, browser steps, performance,
limitations. See "Test suite summary", "Performance measurements", and
`docs/manual-qa-checklist.md`.

## Browser APIs used (compatibility notes)

- Standard ES2020+/DOM APIs (core app logic).
- IndexedDB (via `idb`) — persistence and key storage. Broad support in
  Chromium, Firefox, Safari; behavior details (quota, private browsing)
  vary by browser and are not exercised in this sandbox.
- WebAssembly — required for sql.js. Universally supported in modern
  evergreen browsers; not supported in very old browsers.
- Service Worker / PWA (via `vite-plugin-pwa`, Workbox) — required for
  offline install and app-shell caching. Supported in Chromium and
  Firefox; Safari's service worker support has historically had more
  restrictions/quirks than Chromium's.
- `SpeechRecognition` (M6, voice input) — **optional**, not required for
  core functionality. Support is inconsistent across browsers (well
  supported in Chrome/Chromium-based browsers, absent or limited
  elsewhere). Typed text entry is the guaranteed, universally-supported
  offline input path; voice input is a convenience on top of it, and the
  UI must fall back gracefully where it is unavailable (see
  `src/components/VoiceInputButton.tsx`).

**Realistic support expectation:** the core app (transactions, ledger,
reports, backup) targets modern Chromium-based browsers primarily
(desktop Chrome, Android Chrome), with IndexedDB+WASM expected to also
work on current Firefox and Safari. Voice input is a Chromium-favoring
enhancement, not a cross-browser guarantee.

## Performance measurements

**Environment:** Node.js v22.22.2, Vitest 5, this sandbox container (not
a real mobile browser or device), measured 2026-09-25, using
`performance.now()` around each operation in
`tests/integration/performance.test.ts`. Fixture: 100 sale postings on a
freshly initialized in-memory sql.js database (via `fake-indexeddb`).

Actual measured values from one representative run (printed by the test
via `console.log`, not hand-typed):

| Operation                                           | Measured time                        |
| --------------------------------------------------- | ------------------------------------ |
| DB init from empty (schema creation)                | 33.23 ms                             |
| 100 sequential journal postings (accounting engine) | 134.33 ms total (~1.34 ms/entry avg) |
| Trial Balance report query (100 entries)            | 1.88 ms                              |
| Unsigned backup export (SQLite bytes)               | 1.27 ms                              |
| Signed backup: SHA-256 + Ed25519 sign               | 39.12 ms                             |
| Signed backup: Ed25519 verify                       | 7.95 ms                              |

These numbers vary run-to-run and are **Node/Vitest sandbox timings, not
real mobile browser or device performance**. They demonstrate the
operations complete in low-millisecond-to-double-digit-millisecond time
at this scale in this environment; they say nothing about real-device
WASM startup latency, real IndexedDB commit latency, or memory pressure
on low-end Android hardware.

**Not obtainable in this sandbox:** real-browser/mobile-device memory
profiling (heap size, WASM linear memory growth under sustained use,
IndexedDB storage quota behavior). Manual procedure for a human to run
instead:

1. Open the deployed PWA in Chrome DevTools on the target device (or
   desktop Chrome with device emulation for a first pass).
2. Application tab → confirm IndexedDB database and blob size after
   entering a realistic number of transactions.
3. Performance tab → record a session covering: initial load with cold
   service-worker cache, entering 10-20 transactions, viewing all three
   reports, exporting a signed backup.
4. Memory tab → take a heap snapshot before and after the above session;
   compare retained size to catch leaks; note peak memory during WASM
   operations.
5. Record device model, Chrome version, and the actual numbers observed.

## Airplane-mode / zero-network procedure (documented, not executed here)

This sandbox has no real browser, so the following was **not actually
performed**; it is the reproducible procedure a human reviewer should
follow, with expected results based on the code audit above:

1. Load the deployed PWA once online (installs the service worker and
   precaches the app shell + `sql-wasm.wasm`).
2. Open DevTools → Network tab, clear it, then reload — expected: the
   only requests are the initial navigation and cached assets, no calls
   to any API origin (there is none in the code).
3. Enable OS-level airplane mode (or DevTools' "Offline" throttling as a
   proxy).
4. Reopen the app from the installed icon / reload — expected: app shell
   loads from the service-worker cache with no failed requests.
5. Type a transaction, confirm classification, post it — expected:
   succeeds fully offline (no code path touches the network — confirmed
   by the Step 3-4 grep audit above).
6. View Trial Balance, P&L, Balance Sheet — expected: all three render
   from the local SQLite database.
7. Export an unsigned and a signed backup, then restore — expected: both
   succeed offline (file APIs and IndexedDB only, no network).
8. Turn airplane mode back off; nothing above should have required it.

See `docs/manual-qa-checklist.md` for the fuller device/browser checklist.

## Test suite summary

- Total automated tests (this audit, `npm test`): **274** across 40 test
  files, all passing, run twice to check for order-dependence/flakiness
  (no nondeterminism found; no cleanup fixes were needed — existing
  `beforeEach`/`afterEach` patterns already reset the sql.js singleton,
  the IndexedDB persistence connection, and (where used) the crypto key
  store connection between tests).
- New in Milestone 10: `tests/integration/phase1-regression.test.ts` (2
  tests — canonical full-chain regression, and the negative
  failed-transaction case), `tests/integration/large-fixture.test.ts` (1
  test — 120 deterministic transactions), `tests/integration/performance.test.ts`
  (1 test — real timing measurements). No existing tests were deleted or
  weakened to reach a green suite.

## Deferred / Phase-2 (explicitly not implemented)

The following are genuinely absent from this codebase — no partial
implementation exists, confirmed by this audit's grep passes for network
calls, cloud SDKs, and sync-related code:

- CRDT-based conflict resolution / multi-device sync
- FPO (Farmer Producer Organization) master data sync
- Bluetooth / WebRTC device-to-device transfer
- Automated depreciation scheduling
- Hardware-backed key storage (e.g. WebAuthn/TPM-backed signing keys) —
  current key storage is IndexedDB-only, documented as such
- Cloud backend, hosted API, or any server component
- Authentication / enterprise identity and access management
- Advanced NLP/LLM/RAG-based classification (classification here is
  deterministic keyword/mapping-based only)
- Inventory management
- GST/tax computation engine
- Payroll
- Any broader enterprise ERP module beyond the Phase-1 accounting core

## Scope-creep check (Milestone 10)

Grepped the full `src/` tree for backend/API-route patterns, cloud
persistence clients, auth libraries, and AI/LLM SDK usage — none found.
`package.json` dependencies are limited to the UI framework, routing,
IndexedDB wrapper, sql.js, `@noble/ed25519`/`@noble/hashes` (crypto), and
the PWA build plugin — no cloud SDK, no LLM client, no auth library.
