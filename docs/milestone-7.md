# Milestone 7: Trial Balance, Profit & Loss, Balance Sheet

Read-only reporting projections of the Milestone 3 journal data. Nothing in
this milestone writes to SQLite or IndexedDB, changes the parser or
classifier, or introduces a second accounting model.

## Architecture

`src/features/reports/`:

- `types.ts` — `TrialBalance`, `ProfitAndLoss`, `BalanceSheet` and their row
  types. All money values are integer minor units (paise).
- `queries.ts` — shared, parameterized SQL aggregation primitives
  (`getAccountActivityInPeriod`, `getAccountActivityAsOf`,
  `signedBalance`, `getAllAccountsOrdered`) that every report builds on, so
  no report re-implements the debit/credit-normal logic that already lives
  in `src/features/accounting` (`isDebitNormal`).
- `trial-balance.ts`, `profit-loss.ts`, `balance-sheet.ts` — one function
  each: `getTrialBalance`, `getProfitAndLoss`, `getBalanceSheet`.
- `index.ts` — the only import surface the UI uses.

`src/pages/ReportsPage.tsx` (plus `src/components/ReportTable.tsx` and
`formatMinor.ts`) replaces the Milestone 1 placeholder with a tabbed,
mobile-first view. React only calls the typed report functions above; there
is no SQL, manual journal-line aggregation, or debit/credit-sign logic in
JSX.

## Data source

All three reports read exclusively from `journal_entries` /
`journal_lines` via `queries.ts`. They never read the `transactions` table
or `item_mappings` (classification). This matters for two reasons:

1. Only posted, committed journal entries can appear — see "Rejected
   transactions" below.
2. Reports stay correct even if classification rules change later, since
   they reflect what was actually posted, not how it was classified.

## Date semantics

- Trial Balance and P&L take `startDate`/`endDate`, both **inclusive**.
- Balance Sheet takes a single `asOfDate`, and includes every journal entry
  dated on or before it (also inclusive).
- Dates are compared as the ISO `YYYY-MM-DD` strings SQLite stores them
  (`je.date >= ? AND je.date <= ?` / `je.date <= ?`), never via JS `Date`
  object comparison. This avoids timezone-dependent nondeterminism: a
  browser's local timezone offset can never shift which entries a report
  includes.
- The Reports page's period selector defaults to the current calendar
  month, computed once from local date parts (`getFullYear`/`getMonth`) —
  used only to prefill the `<input type="date">` values, never to filter
  data directly.

## Trial Balance (`getTrialBalance`)

For every account with at least one journal line dated in the period, shows
debit total, credit total, and a closing balance signed per its normal-balance
side (reusing `isDebitNormal` from M3 — asset/expense are debit-normal,
liability/equity/income are credit-normal). Rows are ordered by account code
(`listAccounts()`'s existing order). Exposes `totalDebitsMinor`,
`totalCreditsMinor`, and `isBalanced` (`totalDebitsMinor ===
totalCreditsMinor`) as a boolean the UI surfaces as a status badge — never
hidden or auto-corrected.

## Profit & Loss (`getProfitAndLoss`)

Restricts the same period-scoped activity to `income` and `expense`
accounts only, signs each with `signedBalance`, and computes
`netProfitMinor = totalIncomeMinor - totalExpensesMinor`. Positive is
profit, negative is loss.

## Balance Sheet (`getBalanceSheet`)

Restricts as-of activity to `asset`, `liability`, and `equity` accounts.

### Current-period profit presentation

There is no closing-entry machinery in Phase 1 (Income/Expense accounts are
never zeroed into Equity via a posted journal entry). Rather than invent
one, the Balance Sheet **computes** cumulative profit/loss from inception
through `asOfDate` — by calling `getProfitAndLoss` with a lower bound
(`0000-01-01`) that lexicographically precedes any real journal date — and
presents it as a single "Current period profit/loss" Equity line, in
addition to any directly-posted Equity accounts (e.g. Capital). This is the
simplest interpretation consistent with "no closing entries": the figure is
always derivable purely from journal data and is guaranteed to match what
`getProfitAndLoss` would report for the same period (see
`tests/reports/invariants.test.ts`).

`totalEquityMinor = sum(posted equity accounts) + currentPeriodProfitMinor`.
`isBalanced` is `totalAssetsMinor === totalLiabilitiesMinor +
totalEquityMinor`; when false, the UI shows "Out of balance" rather than
silently reconciling the difference.

## Rejected transactions

Milestone 6's `recordTransaction` only calls `postJournalEntry` after
inserting the `transactions` row; on any posting failure it marks that row
`rejected` and never sets `journal_entry_id`, and `postJournalEntry` itself
only commits (and only then persists) on full success — a failed post
leaves zero rows in `journal_entries`/`journal_lines`. Reports read only
those tables, so a rejected transaction structurally cannot appear in, or
change the totals of, any report. `tests/reports/invariants.test.ts`
verifies this directly by forcing a rejection (an unknown counter account)
and asserting all three reports still show zero/empty for that period.

## Empty-state behavior

With zero accounts and zero journal entries, every report returns clean
zero values — `0`, never `NaN`/`Infinity`/`undefined` — and Trial Balance
and Balance Sheet both report `isBalanced: true` (0 === 0). Covered
explicitly in `tests/reports/invariants.test.ts`.

## Limitations (intentional, Phase 1)

- **No opening balances.** There is no opening-balance feature anywhere in
  M0–M6; every report is computed purely from posted journal data starting
  from zero. A business's first day of using the app is its accounting
  inception date.
- **No closing entries.** Income/Expense balances are never zeroed into
  Equity by a posted journal entry; the Balance Sheet's profit/loss line is
  a computed presentation only, as described above.
- **Single currency**, matching the rest of the app.
- **Deferred**: GST/tax reporting, multi-period comparison, export
  (CSV/PDF), advanced analytics, backup/restore/sync — none of this is in
  scope for M7 and none of it was added.

## Invariants tested

`tests/reports/{trial-balance,profit-loss,balance-sheet,invariants}.test.ts`,
using real sql.js (same pattern as `tests/accounting/*.test.ts`):

- Debits = credits on every non-empty Trial Balance.
- P&L net profit/loss matches a fixture's known journal data exactly.
- Balance Sheet: Assets = Liabilities + Equity.
- The current-period profit/loss figure is identical between the P&L
  report and the Balance Sheet's equity line for the same period.
- Date-boundary handling: before/after period excluded, start/end
  boundaries included, empty period → zeros, Balance Sheet excludes entries
  dated after `asOfDate`.
- Rejected-transaction exclusion.
- Empty-database clean zero values.
- Integer minor-unit handling for ₹0.01, ₹500, ₹1,250.50, and a large safe
  integer amount, with explicit `Number.isInteger`/`Number.isSafeInteger`
  assertions.

## Query safety and performance

Every query in `queries.ts` uses sql.js parameter binding
(`db.query(sql, [param, ...])`) — no string-interpolated dates or other
values are ever spliced into SQL text. Aggregation (`SUM`/`GROUP BY`) is
done in SQL rather than pulling whole tables into JS.
