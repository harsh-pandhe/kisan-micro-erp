# Milestone 6: End-to-End Transaction Workflow

This milestone wires the existing Milestone 4 parser, Milestone 5
classifier and Milestone 3 accounting engine together behind a real
mobile-first UI, plus basic voice input. It adds no new domain logic: the
UI and the new `src/features/transactions/` module only call the existing
typed functions from `src/parser`, `src/features/classification` and
`src/features/accounting`.

## End-to-end flow

```
Text/voice input
      |
      v
parseTransactionText()  [M4]  -> ParseResult (SUCCESS / AMBIGUOUS / INVALID)
      |
      v  (SUCCESS only)
classify()               [M5]  -> ClassifiedTransaction (matched / unknown / ambiguous / invalid)
      |
      v  (user resolves UNKNOWN/AMBIGUOUS by picking an account; optionally learnMapping/relearnMapping)
User reviews & explicitly presses "Record Transaction"
      |
      v
recordTransaction()      [M6, src/features/transactions/service.ts]
      |
      +--> INSERT transactions row (status: parsed)
      +--> postPurchase/postSale/postPayment/postReceipt() [M3] -> postJournalEntry() [M3]
      +--> UPDATE transactions row (journal_entry_id, status: posted)  |  on failure: status: rejected
      +--> persistDatabase()        [M2]
```

Every step above is driven from `src/pages/TransactionsPage.tsx`, which
holds an explicit UI state machine (idle input -> parsed -> classified ->
ready to review -> posting -> success/error) in plain React state. The
page never duplicates parsing, classification or debit/credit logic — see
"Architectural boundaries" below.

## Parser / classifier / accounting integration points

- `src/components/TransactionInput.tsx` collects raw text (typed or from
  voice) and, on "Parse", `TransactionsPage` calls
  `parseTransactionText()` directly.
- On `SUCCESS`, `TransactionsPage` calls `classify()` on
  `result.transaction` and renders the outcome via
  `ClassificationCard`.
- On confirmation, `TransactionsPage` resolves: the **item account** (from
  classification) and a **counter account** (cash/bank/party, picked by
  the user via a plain `<select>` populated from `getAllAccounts()`), maps
  the parsed `type` to the right M3 operation
  (`postPurchase`/`postSale`/`postPayment`/`postReceipt`), and calls
  `recordTransaction()` in `src/features/transactions/service.ts`, which
  performs the `transactions` row bookkeeping and delegates the actual
  posting to the M3 operation. `postJournalEntry()` (called internally by
  those M3 operations) is the only code path that ever inserts into
  `journal_entries`/`journal_lines`.

## User confirmation behavior (no auto-posting)

Parsing and classification succeeding is never sufficient to post. The
`TransactionReview` card is the single confirmation point: nothing is
written to SQLite until the user explicitly presses **Record
Transaction**. The confirm button is disabled while a counter account
hasn't been chosen, and again while a post is in flight
(`isPosting`), so one click posts exactly one journal entry — this is
covered by the "no double submission" test in
`tests/features/transactions/workflow.test.ts`.

## UNKNOWN / AMBIGUOUS handling and the learning flow

- **MATCHED**: `ClassificationCard` shows the matched account and match
  reason. The user can press "Change account" to override it (this does
  **not** auto-relearn; the "remember this" checkbox has to be ticked
  too).
- **UNKNOWN** / **INVALID**: the user must pick an account from a
  `<select>` of all accounts. If "Remember this for next time" is
  checked, confirming calls `learnMapping()` (M5) using the parsed
  transaction's `description` as the key, before posting.
- **AMBIGUOUS**: the user must pick one of the surfaced candidate
  accounts (`classification.candidates`); the "remember" checkbox is not
  offered here, since mapping the ambiguous term to a specific account
  would silently resolve a genuinely ambiguous case in the item mapping —
  left as a deliberate limitation matching M5's design (no mapping is
  written for an ambiguous key).
- Changing an existing MATCHED classification and asking to remember it
  calls `relearnMapping()`, never a silent side effect of classification
  itself.
- Learning always runs (when requested) **before** posting, inside the
  same `handleConfirm` call; if learning throws, posting does not happen
  and the error is shown without a false success message.

## Transaction persistence & history

`src/features/transactions/service.ts` is the only module that inserts
into or reads the `transactions` table:

- `recordTransaction()` inserts a `transactions` row, posts the journal
  entry via M3 with `sourceTransactionId` set to that row's id, then
  updates the row's `journal_entry_id`/`status`. On any failure it marks
  the row `rejected` (never leaves it dangling as `pending`) and
  re-throws — no partial journal data is left behind, since
  `postJournalEntry()` only commits and persists on full success.
- `listTransactionHistory()` is a typed, read-only join of `transactions`
  with `journal_entries`/`journal_lines`, ordered `ORDER BY t.id DESC`
  (deterministic newest-first), used by both the Transactions page history
  list and the Dashboard's "recent transactions" tile.
- `countTransactions()` is a cheap `COUNT(*)` used only for the dashboard
  tile — not a report/aggregation.

The `transactions` row's `raw_text`/`journal_entry_id`/`status` and the
journal entry's `source_transaction_id` together give a full audit trail
from raw input to posted double-entry lines with no orphan rows (see the
linkage test in `workflow.test.ts`).

## Accounts page

`src/pages/AccountsPage.tsx` lists accounts via `getAllAccounts()` (M3)
and offers a minimal creation form (`AccountForm`: code, name, type)
that calls `createAccount()` (M3) directly, validates required fields
client-side before submit, and refreshes the list / clears the form on
success. No opening balances or advanced configuration, per scope.

## Dashboard changes

`src/pages/DashboardPage.tsx` now shows a transaction count
(`countTransactions()`) and up to 5 recent transactions
(`listTransactionHistory(5)`) plus a "Database: Ready" tile. It does
**not** compute Trial Balance, P&L or Balance Sheet — that is Milestone 7.

## Voice input

`src/components/VoiceInputButton.tsx` uses the browser's native
`SpeechRecognition`/`webkitSpeechRecognition` API to transcribe speech
into the **same** textarea used for typed input — the transcript is never
parsed by a separate code path; it goes through the identical
`parseTransactionText()` call once the user presses Parse.

- If neither `window.SpeechRecognition` nor
  `window.webkitSpeechRecognition` exists, the component renders "Voice
  input is not supported in this browser." and the typed-input flow is
  completely unaffected.
- A small language selector switches `recognition.lang` between
  `en-IN` (English) and `hi-IN` (Hindi) — not an elaborate settings
  system, just the one control the mic needs.
- No audio is recorded or persisted anywhere; only the resulting
  transcript text is used, and it is only ever written to SQLite if the
  user goes on to confirm a transaction through the normal review flow.
- **Privacy is not on-device by default.** Speech recognition behavior is
  entirely up to the browser/OS: on Chrome/Chromium, `webkitSpeechRecognition`
  typically streams audio to a Google cloud speech service; other
  browsers/platforms may behave differently. This module makes no
  on-device-privacy claim.

## Offline behavior

The typed flow — type → `parseTransactionText()` → `classify()` → user
confirms → `recordTransaction()` → `postJournalEntry()` →
`persistDatabase()` — makes zero network calls; it is pure
JS/SQLite-WASM/IndexedDB. This was verified by grepping the new UI and
`src/features/transactions` code for `fetch(`/`XMLHttpRequest` (none
found) and by the fact none of M2–M5 touch the network either.

**Exception: voice input.** Speech recognition is provided by the
browser, and on at least one major browser (Chrome) it is
network-backed. Voice input should therefore not be assumed to work
offline; only the typed flow is guaranteed to.

## Error handling per failure mode

| Failure | What happens |
| --- | --- |
| Parser `INVALID` | `ParseResultCard` shows a plain-language message and the parser's `reasons`; nothing else runs. |
| Parser `AMBIGUOUS` | Shown with reasons; classification/review are not offered until the text is fixed and re-parsed to `SUCCESS`. |
| Classification `unknown`/`ambiguous`/`invalid` | User must resolve via the account picker before the review card appears (`canReview` stays false). |
| `learnMapping`/`relearnMapping` throws | Caught in `handleConfirm`; posting does not proceed; error shown, input preserved. |
| `recordTransaction` throws (e.g. `AccountNotFoundError`, `UnbalancedEntryError`, `DuplicateVoucherError`) | Caught in `handleConfirm`; `postError` is shown next to the confirm button; input and draft state are preserved so the user can fix and retry; the `transactions` row is marked `rejected`, not left as a false "posted". |
| IndexedDB persistence failure | Surfaces as a thrown `DatabaseError` from `persistDatabase()`, handled the same way as any other `recordTransaction` failure. |

## Architectural boundaries

- **No SQL in React.** `src/pages` and `src/components` never import
  `getDatabase()` or write SQL; verified by grep (see commit diff).
- **No duplicated parser/classifier/accounting logic in the UI.** The UI
  only calls `parseTransactionText()`, `classify()`,
  `learnMapping()`/`relearnMapping()`, `getAllAccounts()`,
  `createAccount()`, `postPurchase`/`postSale`/`postPayment`/`postReceipt()`
  (via `recordTransaction()`), and `listTransactionHistory()`/
  `countTransactions()`.
- `src/features/transactions/service.ts` is allowed to touch SQL directly
  (like `src/features/accounting/accounts.ts` and
  `src/features/classification/mappings.ts` already do), but only for the
  `transactions` table itself — it never inserts into
  `journal_entries`/`journal_lines` directly; that stays exclusively
  inside `postJournalEntry()`.

## Draft state

Parsed/classified transaction state lives only in `TransactionsPage`'s
React state (`useState`), never in SQLite or `localStorage`. A page
refresh before pressing "Record Transaction" discards the in-progress
draft — this is a known, intentional limitation (Step 6 of this
milestone's spec): only confirmed, posted transactions are durable.

## Accessibility

- The textarea has a visible `<label>` ("Describe the transaction").
- The mic button has `aria-label="Start voice input"` /
  `aria-label="Stop voice input"` and `aria-pressed`.
- Loading/listening/error states use `role="status"`/`role="alert"` with
  `aria-live="polite"` where appropriate (parse/classification cards,
  posting error, success message, "Listening…" indicator).
- All interactive controls are real `<button>`/`<select>`/`<input>`
  elements (via the existing `Button`/`Input` primitives), so they are
  keyboard reachable and have the existing 44px minimum touch target.

## What's intentionally deferred

Out of scope for this milestone (per the M6 spec and the wider roadmap):
advanced search, editing/deleting posted transactions, period closing,
GST, tax reports, inventory, depreciation, payroll, budgets, aging
reports, cloud sync, CRDT, authentication, cryptography/encryption,
exports, backup/restore, and Trial Balance/P&L/Balance Sheet reports
(Milestone 7).

## Manual/browser verification checklist (not run in this sandbox)

This sandbox is headless and cannot exercise real microphone permission
prompts or a real mobile browser. A human should verify:

1. Open the app in Chrome on an Android phone (or desktop Chrome as a
   stand-in).
2. Go to Transactions, tap the mic button, grant the microphone
   permission prompt, and say e.g. "Paid five hundred cash for
   fertilizer".
3. Confirm the transcribed text appears in the textarea, then tap
   "Parse" and confirm the parsed fields look right.
4. Confirm the transaction and verify it appears in the history list and
   the Dashboard's recent-transactions tile.
5. Reload with the browser's network disabled (airplane mode, or DevTools
   offline) and confirm the typed flow (steps above minus voice) still
   works end to end.
