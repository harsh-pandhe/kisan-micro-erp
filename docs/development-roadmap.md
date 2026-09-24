# Development Roadmap — Phase 1

Small, sequential milestones. Do not skip ahead — each milestone should be
demoable and tested before the next starts.

- **Milestone 0 — Repository + architecture** ✅ (this commit)
  Repo, structure, schema design, docs, CI skeleton.

- **Milestone 1 — Application shell + PWA**
  Routable React shell, installable PWA (manifest + service worker), basic
  navigation, no real data yet.

- **Milestone 2 — SQLite-WASM + IndexedDB**
  sql.js wired up, schema applied on first run, serialize/persist round-trip
  to IndexedDB working and tested.

- **Milestone 3 — Accounting schema + double-entry engine**
  Voucher generators for all four transaction types, `debit === credit`
  enforced and unit-tested.

- **Milestone 4 — Transaction parser**
  Deterministic Hindi/Hinglish parser per `docs/parser-spec.md`, tested
  against a fixed phrase table.

- **Milestone 5 — Ledger classification**
  Known-item auto-classification, unknown-item flow, persistent
  `item_mappings`.

- **Milestone 6 — Transaction UI**
  Mobile-first entry screen: text input + device speech-to-text, review,
  confirm/post.

- **Milestone 7 — Reports**
  Trial Balance, basic P&L, basic Balance Sheet, income/expense dashboard.

- **Milestone 8 — Backup/restore**
  Local export/import of the full database file.

- **Milestone 9 — Cryptographic sealing**
  SHA-256 + Ed25519 signing of exports, on-device key generation/storage.

- **Milestone 10 — Testing + Review-1 evidence**
  Full test pass, airplane-mode demo, fill in `docs/review-1-evidence.md`
  with real evidence.

Explicitly not scheduled in Phase 1: CRDT sync, multi-device sync, FPO
master database, Bluetooth/WebRTC transfer, automated depreciation,
LLM-based parsing, any cloud backend, user accounts, hardware-backed keys,
full Tally/GST compatibility.
