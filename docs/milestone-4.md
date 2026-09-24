# Milestone 4: Deterministic Transaction Text Parser

This milestone adds `src/parser/`, a pure, deterministic text parser that
turns raw user input (typed or eventually transcribed speech) into a
`ParsedTransaction`. It has **no dependency** on SQLite, IndexedDB, the
Milestone 3 accounting engine, React, account IDs, journal entries,
reports, crypto, network, or any LLM/AI/fuzzy matching.

## Pipeline

```
Raw user text
      |
      v
Normalization (src/parser/normalize.ts)
      |
      v
Deterministic parser (src/parser/index.ts + amount/date/party/
                       transaction-type/payment-mode.ts)
      |
      v
ParsedTransaction
      |
      v
Validation (src/parser/validate.ts)
      |
      v
ParseResult: SUCCESS | AMBIGUOUS | INVALID
```

Future milestones continue this pipeline but are **not** built here:

```
ParsedTransaction -> Classification (M5: item->ledger mapping) ->
Accounting Operation -> JournalEntry -> SQLite (M3, already built)
```

The parser and any future UI must never bypass classification/accounting
to post a `ParsedTransaction` directly as a journal entry — the only writer
of `journal_entries`/`journal_lines` remains `postJournalEntry()` in
`src/features/accounting/posting.ts` (see `docs/accounting-model.md`).

## Module layout (`src/parser/`)

- `types.ts` — `ParsedTransaction`, `ParseResult`, `ParsedAmount`,
  `AmountParseResult`.
- `normalize.ts` — `normalizeText()`.
- `amount.ts` — `findAmountToken()`, `parseAmount()` (integer-arithmetic
  money parsing into minor units).
- `transaction-type.ts` — `detectTransactionTypes()` (closed-vocabulary
  keyword matcher).
- `payment-mode.ts` — `extractPaymentModes()`.
- `date.ts` — `extractDate()`, `isValidCalendarDate()` (reference date
  injected, defaulting to `new Date()`).
- `party.ts` — `extractParty()`, `extractDescription()`.
- `validate.ts` — `validateParsedTransaction()`.
- `index.ts` — `parseTransactionText()`, the public entry point; re-exports
  everything above.

## Normalization rules

NFKC Unicode normalization, trim, collapse internal whitespace, lowercase,
and canonicalize `Rs.`/`Rs`/`INR` immediately preceding digits to `₹`. The
original `rawText` is always preserved alongside `normalizedText` in the
result.

## Amount parsing

Never uses floating-point arithmetic for the stored value: the numeric
string is split on its decimal point, each half validated as digits only,
and the minor-units integer is built via string concatenation +
`Number.parseInt`. Supports `₹500`, `500`, `Rs 500`, `Rs. 500`,
`500 rupees`, comma thousands separators (`₹1,250`), and up to 2 decimal
digits (`1,250.50`). Rejects bare `₹`, non-numeric amounts (`₹abc`), more
than 2 decimal digits, and negative amounts — always as an explicit parse
failure, never a best-effort guess.

## Transaction types supported

Closed vocabulary only, see `docs/parser-spec.md` for the exact keyword
table: `purchase`, `sale`, `payment`, `receipt`. Zero or multiple keyword
matches never resolve to a guessed type.

## Merchant/party and description extraction

`from X` / `to X` -> party. `for X` -> description, unless the word after
"for" is itself money (then the item precedes the verb, e.g. "Bought
fertilizer for ₹500"). Hinglish `X ke liye` -> description. Purely
pattern-based; no merchant database, no fuzzy matching (that's Milestone 5).

## Payment modes supported

`cash`/`nagad`, `upi`, `bank`/`neft`/`rtgs`/`imps`, `card` — explicit
keywords only. Absent from text -> `undefined`, never inferred.

## Date support

`today`/`aaj`, `yesterday`/`kal` (resolved against an injectable reference
date, defaulting to `new Date()` — the only allowed call site), and explicit
`DD/MM/YYYY` or `DD-MM-YYYY` validated as real calendar dates. Malformed
dates (e.g. `32/13/2026`) are ignored, leaving `date` undefined, rather than
reinterpreted.

## Success / Ambiguous / Invalid semantics

- **SUCCESS**: type + amount extracted unambiguously, any present
  date/payment-mode/party is unambiguous, and structural validation passes.
- **AMBIGUOUS**: something is present but underspecified or conflicting —
  e.g. two transaction-type keywords match, or an amount is found with no
  type keyword but some other context (party/description/payment mode).
- **INVALID**: no usable structure — empty/whitespace input, a malformed
  amount, or a bare number with zero surrounding context (e.g. `"500"`
  alone is never silently promoted to a transaction).

## Examples

Success (English): "Bought fertilizer for ₹500", "Paid ₹500 cash for
fertilizer", "Paid ₹1200 via UPI", "Sold wheat for ₹5000", "Received ₹3000
from Ramesh".

Success (Hindi/Hinglish): "kharcha 500 hua fertilizer ke liye", "₹500 cash
diya to Ramesh", "Suresh se 1000 mila", "₹5000 sale hui wheat ke liye".

Unsupported/ambiguous: bare `"500"` (INVALID — no verb/context), `"₹abc"`
(INVALID — malformed amount), `""` (INVALID — empty input), `"₹12.345"`
(INVALID — 3 decimal digits), `"bought and sold wheat for ₹500"` (AMBIGUOUS
— conflicting type keywords), `"₹500 for fertilizer"` (AMBIGUOUS — amount
and description present but no type keyword).

## Parser/accounting boundary

`ParsedTransaction` is **not** a journal entry. It carries no account IDs
and no debit/credit information. The full pipeline through to persistence
is:

```
Raw Text -> Parser (M4, this milestone) -> ParsedTransaction
         -> Classification (M5, item/party -> ledger mapping)
         -> Accounting Operation -> JournalEntry
         -> SQLite (M3, already built, via postJournalEntry())
```

Nothing in this milestone reads or writes SQLite/IndexedDB, imports React,
or calls into `src/features/accounting`.

## Testing

`tests/parser/normalization.test.ts`, `amount.test.ts`,
`transaction-type.test.ts`, `parser.test.ts`, and `invalid-input.test.ts`
are table-driven and cover all required examples from the milestone spec,
plus purity/determinism checks (repeated parsing of identical input
yields `toEqual` results, minor units are always `Number.isInteger`, and
no test imports `src/db`, `src/features/accounting`, or `react`).
