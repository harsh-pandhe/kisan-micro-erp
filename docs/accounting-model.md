# Accounting Model

## The one invariant that matters

For every `journal_entries` row:

```
SUM(journal_lines.amount_minor WHERE side = 'debit')
  === SUM(journal_lines.amount_minor WHERE side = 'credit')
```

This must hold **by construction**, not by validation-after-the-fact. Every
voucher generator in `src/features/accounting/` takes a normalized,
classified transaction and returns a fully-balanced `JournalEntry` +
`JournalLine[]`; there is no code path that can write an entry to SQLite
before this invariant is checked. The check itself is a plain function
(`assertBalanced` or equivalent) that both the voucher generator and the
persistence layer call before any INSERT — belt and suspenders.

## Voucher types → default double entries (Phase 1)

| Voucher type | Debit                       | Credit                   |
| ------------ | --------------------------- | ------------------------ |
| Purchase     | Item/expense ledger         | Cash or Party (creditor) |
| Sale         | Cash or Party (debtor)      | Sales/income ledger      |
| Payment      | Party (creditor) or expense | Cash/bank                |
| Receipt      | Cash/bank                   | Party (debtor) or income |

The exact ledgers on each side come from ledger classification
(`src/features/ledgers/`, item→account mapping), not from the accounting
engine itself — the engine only knows "which side" for a given voucher type,
never "which account."

## Why this is independently testable

The engine's public surface is pure functions: `(NormalizedTransaction,
ChartOfAccounts) → JournalEntry`. No database, no UI, no I/O. That means:

- Unit tests can assert debit=credit for every voucher type without ever
  touching sql.js or IndexedDB.
- The parser can be tested separately by asserting it produces the right
  `NormalizedTransaction` for a given phrase, without knowing anything about
  ledgers or journals.
- Persistence can be tested by round-tripping arbitrary valid journal entries
  through serialize→IndexedDB→deserialize, without generating them via the
  real parser.

This separation is the main reason the pipeline in `docs/architecture.md` is
drawn as five distinct boxes instead of one "process transaction" function.
