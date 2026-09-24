# Parser Spec (Milestone 4 — implemented)

This document is the fixed contract for `src/parser`. It supersedes the
Phase-1 placeholder that used to live here.

## Contract

```
parseTransactionText(rawText: string, referenceDate?: Date) -> ParseResult

ParseResult =
  | { status: 'SUCCESS',   transaction: ParsedTransaction }
  | { status: 'AMBIGUOUS', transaction: ParsedTransaction, reasons: string[] }
  | { status: 'INVALID',   rawText: string, reasons: string[] }
```

`parseTransactionText` is a **pure function of its input text** (plus an
optional injected reference date used only to resolve "today"/"yesterday").
No I/O, no database, no network, no ML/LLM/fuzzy matching.

## ParsedTransaction

```ts
interface ParsedTransaction {
  type: 'purchase' | 'sale' | 'payment' | 'receipt' | undefined;
  amount: { minorUnits: number; currency: 'INR' } | undefined;
  party: string | undefined; // from "from X" / "to X"
  description: string | undefined; // from "for X" / "X ke liye"
  date: string | undefined; // ISO 8601 YYYY-MM-DD
  paymentMode: 'cash' | 'upi' | 'bank' | 'card' | undefined;
  rawText: string;
  normalizedText: string;
}
```

No account IDs, no debit/credit lines, no accounting-service references —
those belong to Milestone 5 (classification) and the already-built
Milestone 3 accounting engine.

## Normalization

- Unicode NFKC normalization.
- Trim + collapse internal whitespace.
- Lowercase.
- `Rs.`/`Rs`/`INR` immediately before digits -> `₹`.

## Amount parsing

Integer-arithmetic only — the decimal string is split on `.` and each half
handled as an integer; the final minor-units value is never produced via
`parseFloat`. Supported forms: `₹500`, `500`, `Rs 500`, `Rs. 500`,
`500 rupees`, `₹1,250` (comma thousands separator), `1,250.50` (optional
2-decimal paise). Rejected: bare `₹`, `₹abc`, empty string, more than 2
decimal digits (e.g. `₹12.345`), negative amounts.

## Transaction type (closed vocabulary)

| Type     | Trigger keywords                                               |
| -------- | -------------------------------------------------------------- |
| purchase | bought, purchased, kharida/kharidi, khareeda/khareedi, kharcha |
| sale     | sold, becha/bechi, "sale hui"                                  |
| payment  | paid, diya/diye, payment                                       |
| receipt  | received, mila/mili, receipt                                   |

Zero matches or more than one distinct type matching -> not a confident
`SUCCESS` (AMBIGUOUS/INVALID). No fuzzy/semantic inference.

## Payment mode (closed vocabulary)

`cash`/`nagad` -> cash, `upi` -> upi, `card` -> card, `bank`/`neft`/`rtgs`/`imps`
-> bank. Absent from text -> `undefined` (never inferred). More than one
keyword matching -> ambiguous.

## Date extraction

- `today` / `aaj` -> reference date.
- `yesterday` / `kal` -> reference date minus 1 day.
- Explicit `DD/MM/YYYY` or `DD-MM-YYYY`, validated as a real calendar date.
- Anything else (relative phrases, ambiguous forms) is ignored, not guessed.
- `referenceDate` defaults to `new Date()`, the one permitted call site; all
  other logic takes it as a parameter for deterministic tests.

## Merchant/party and description extraction

- `from X` -> `party = X` (e.g. receipt source).
- `to X` -> `party = X` (e.g. payment recipient).
- `for X` -> `description = X`, **unless** X looks like a money token (₹, a
  digit, or "rupees"), in which case the item precedes the type verb instead
  ("Bought **fertilizer** for ₹500") and that preceding phrase is used.
- `X ke liye` -> `description = X` (Hinglish equivalent).
- Extraction trims trailing amount/date/payment-mode fragments and applies
  simple title-casing; no semantic/merchant-database matching.

## Supported grammar examples

English: "Bought fertilizer for ₹500", "Paid ₹500 cash for fertilizer",
"Paid ₹1200 via UPI", "Sold wheat for ₹5000", "Received ₹3000 from Ramesh".

Hindi/Hinglish: "kharcha 500 hua fertilizer ke liye", "₹500 cash diya to
Ramesh", "Suresh se 1000 mila", "₹5000 sale hui wheat ke liye".

## Result semantics

- **SUCCESS**: type, amount, and (if present) date/payment-mode/party all
  extracted unambiguously and pass validation.
- **AMBIGUOUS**: some required info is present but underspecified or
  conflicting (e.g. two type keywords matched, amount present but no type
  keyword and no other context, a validation rule fails on an otherwise
  extracted transaction).
- **INVALID**: no usable structure at all (empty input, malformed amount,
  or a bare number/phrase with zero context — e.g. "500" alone is never
  silently promoted to a transaction).

## Explicitly out of scope (later milestones)

- Item→ledger classification, merchant normalization database,
  self-learning, account recommendation/auto-creation (Milestone 5).
- Any UI, voice input, or calling the parser from React (Milestone 6).
- Converting `ParsedTransaction` into a `JournalEntry` — the parser never
  touches accounts, debit/credit, or SQLite.

## Testability

Table-driven tests under `tests/parser/*.test.ts` assert `(input, optional
reference date) -> expected ParseResult`, run without sql.js, IndexedDB, or
React.
