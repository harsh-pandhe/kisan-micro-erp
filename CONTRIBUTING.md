# Contributing

## Setup

```bash
npm install
npm run dev
```

## Before committing

```bash
npm run lint
npm run format:check
npm run test
npm run build
```

CI runs the same checks on every push/PR (`.github/workflows/ci.yml`).

## Conventions

- **No direct DB access from UI/React components.** Go through the service
  layer (`src/features/*`). See [docs/architecture.md](docs/architecture.md).
- **No `any`-typed money.** Amounts are integers in minor units
  (`amountMinor`), never floats — see [docs/database-schema.md](docs/database-schema.md).
- **The parser is pure.** No I/O, no database, no side effects — see
  [docs/parser-spec.md](docs/parser-spec.md).
- **Every voucher generator must be independently unit-testable** against the
  `debit === credit` invariant, without a real database — see
  [docs/accounting-model.md](docs/accounting-model.md).
- **Don't build ahead of the current milestone.** Check
  [docs/development-roadmap.md](docs/development-roadmap.md) before adding a
  Phase-2+ feature.
- Commit messages: short, imperative (`fix:`, `feat:`, `chore:`, `docs:`
  prefixes welcome but not enforced).
