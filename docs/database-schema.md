# Database Schema (Phase 1)

Source of truth: [`src/db/schema.ts`](../src/db/schema.ts) (`SCHEMA_SQL`). This
document explains the design; the code is authoritative on exact DDL.

## Tables

### `accounts`

Chart of accounts / ledgers. `type` is one of `asset | liability | equity |
income | expense`. `parent_id` allows simple grouping (e.g. "Cash" under
"Current Assets") without a full tree-report engine in Phase 1.

### `journal_entries`

One row per voucher (purchase, sale, payment, receipt, or manual journal).
`voucher_number` is unique and human-referenceable. `source_transaction_id`
links back to the `transactions` row that generated it, when applicable.

### `journal_lines`

The actual debit/credit legs of a journal entry. `amount_minor` is a positive
integer in minor currency units (paise) — never a float, to avoid rounding
drift. `SUM(amount_minor) WHERE side='debit'` must equal `SUM(amount_minor)
WHERE side='credit'` for a given `journal_entry_id`; this is enforced in the
accounting engine (`src/features/accounting/`), not just hoped for — see
`docs/accounting-model.md`.

### `transactions`

Raw user input (typed or speech-transcribed) plus parse/posting status. This
is the audit trail from "what the user actually said" to "what got posted."
`status` moves `pending → parsed → (needs_classification) → posted`, or
`rejected` if parsing fails outright.

### `item_mappings`

Persistent item-name → account mappings, keyed by a normalized item name.
Populated the first time a user classifies an unknown item; read on every
subsequent parse so the same item never has to be classified twice.

### `settings`

Flat key/value metadata table (schema version, device key fingerprint, last
backup timestamp, etc.). Deliberately untyped — this is config, not domain
data.

## Design decisions

- **Integers for money, not REAL.** SQLite's dynamic typing makes it easy to
  accidentally store floats; the schema CHECK constraints and the TypeScript
  types (`src/types/accounting.ts`) both treat amounts as integer minor
  units to close that door in two places.
- **Foreign keys, not implicit joins.** `journal_lines.account_id` and
  `journal_lines.journal_entry_id` are real `REFERENCES`, so an orphaned line
  is a constraint violation, not a silent bug.
- **No soft-delete / audit columns yet.** Phase 1 has no multi-user or
  correction workflow beyond "post a reversing entry," so `updated_at` /
  `deleted_at` columns would be speculative. Add them when a real Phase-2
  requirement needs them.
