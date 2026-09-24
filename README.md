# Kisan Micro-ERP

Offline-first micro-accounting / bookkeeping for small farmers and traders.
No backend, no account, no internet required for normal use.

**Status:** Phase 1 MVP (₹30,000, ~2 months). See
[docs/development-roadmap.md](docs/development-roadmap.md) for milestone
status and [docs/architecture.md](docs/architecture.md) for the full design
rationale.

## Pipeline

```
Text / phone speech-to-text
  → deterministic transaction parser
  → ledger / item classification
  → voucher generation
  → double-entry accounting
  → SQLite compiled to WebAssembly
  → IndexedDB persistence
  → reports
  → basic cryptographic signing
```

## Stack

- TypeScript + React + Vite
- PWA (`vite-plugin-pwa`) — installable, offline-capable
- [`sql.js`](https://github.com/sql-js/sql.js) — SQLite compiled to
  WebAssembly (chosen over `@sqlite.org/sqlite-wasm` for its simpler
  serialize-to-`Uint8Array` model; see [docs/architecture.md](docs/architecture.md#2-why-sqlite-wasm-sqljs))
- [`idb`](https://github.com/jakearchibald/idb) — IndexedDB persistence
- [`@noble/hashes`](https://github.com/paulmillr/noble-hashes) /
  [`@noble/ed25519`](https://github.com/paulmillr/noble-ed25519) — SHA-256
  hashing and Ed25519 signing of financial exports
- Vitest + Testing Library
- ESLint + Prettier
- GitHub Actions CI

Fully client-side by design — no Firebase, no Postgres/MySQL, no Express/
Next.js API routes, no cloud backend. See "Out of scope" in
[docs/architecture.md](docs/architecture.md#9-what-is-intentionally-excluded-from-phase-1).

## Getting started

```bash
npm install
npm run dev
```

```bash
npm run build      # type-check + production build
npm run test        # run tests once
npm run test:watch  # watch mode
npm run lint         # ESLint
npm run format:check # Prettier check
```

## Project structure

```
src/
  app/                 shell, routing
  components/           shared UI components
  features/
    transactions/        transaction capture + lifecycle
    accounting/           double-entry journal engine
    ledgers/               chart of accounts, item classification
    reports/                Trial Balance, P&L, Balance Sheet, dashboard
    persistence/             sql.js <-> IndexedDB, backup/restore
    crypto/                    SHA-256 hashing, Ed25519 signing
  db/                   SQLite schema + query layer
  parser/                deterministic Hindi/Hinglish transaction parser
  types/                shared domain types
tests/
docs/                  architecture, schema, accounting model, parser spec,
                         roadmap, Review-1 evidence plan
```

## Documentation

- [Architecture](docs/architecture.md)
- [Database schema](docs/database-schema.md)
- [Accounting model](docs/accounting-model.md)
- [Parser spec](docs/parser-spec.md)
- [Development roadmap](docs/development-roadmap.md)
- [Review-1 evidence plan](docs/review-1-evidence.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).
