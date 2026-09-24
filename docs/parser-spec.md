# Parser Spec (Phase 1 scope)

Not implemented yet (Milestone 4). This document records the intended
contract so implementation has a fixed target.

## Contract

```
parse(rawText: string) -> ParseResult

ParseResult =
  | { kind: 'ok', transaction: NormalizedTransaction }
  | { kind: 'needs_classification', transaction: PartialTransaction, unknownItem: string }
  | { kind: 'unrecognized', rawText: string }
```

The parser is a **pure function of its input text** — no I/O, no database
access, no network. It may consult a supplied item→ledger lookup (passed in,
not fetched) to decide `ok` vs `needs_classification`, but it never writes
anything.

## In scope for Phase 1

- Deterministic rule/regex matching, not statistical/LLM parsing.
- Basic Hindi/Hinglish phrasing for the four voucher types, e.g.:
  - "100 kg gehu becha 2000 rupaye me" → sale, item=wheat, qty=100kg, amount=2000
  - "500 rupaye khaad kharida" → purchase, item=fertilizer, amount=500
  - "Ramesh ko 300 diya" → payment, party=Ramesh, amount=300
  - "Suresh se 1000 mila" → receipt, party=Suresh, amount=1000
- Numeral handling for both Devanagari and Latin digits.
- Graceful `unrecognized` result when the phrase doesn't match any known
  pattern — routed to a manual entry fallback, not guessed.

## Explicitly out of scope for Phase 1

- Unlimited natural-language understanding / free-form sentences.
- Multi-transaction-per-utterance splitting.
- Context carried across utterances (e.g. pronoun resolution).
- Any ML/LLM-based extraction.

## Testability

Because `parse()` is pure, its test suite is a table of
`(input string) → expected NormalizedTransaction | classification-needed |
unrecognized`, run without any database or browser APIs.
