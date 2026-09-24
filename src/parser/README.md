# parser

Deterministic rule/regex parser for English/Hindi/Hinglish transaction
phrases -> `ParsedTransaction`. Milestone 4.

Entry point: `parseTransactionText(rawText, referenceDate?)` in `index.ts`.
Pure function, no I/O, no database, no React, no ML/LLM. See
`docs/parser-spec.md` for the field/grammar contract and
`docs/milestone-4.md` for the full write-up.
