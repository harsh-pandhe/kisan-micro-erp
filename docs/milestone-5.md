# Milestone 5: Deterministic Ledger Classification & Self-Learning Mappings

This milestone adds `src/features/classification/`, which maps a
Milestone 4 `ParsedTransaction` to an existing account, using and
extending the `item_mappings` table already defined in Milestone 2's
schema. It does **not** post journal entries, does **not** mutate
balances, does **not** auto-create accounts, does **not** modify the
parser, and has **no** UI.

## Pipeline

```
Raw text -> M4 Parser -> ParsedTransaction
                              |
                              v
                 M5 Classification (this milestone)
                              |
                              v
                    ClassifiedTransaction
                              |
                              v
     (future M6/accounting layer composes this into a posting)
```

## Module layout (`src/features/classification/`)

- `types.ts` — `ClassifiedTransaction` (discriminated union: matched /
  unknown / ambiguous / invalid), `ItemMapping`, `ClassificationError` and
  its subclasses.
- `normalize.ts` — `normalizeForClassification()`, `tokenize()`.
- `mappings.ts` — CRUD over `item_mappings` (`createMapping`,
  `updateMapping`, `upsertMapping`, `findMappingByNormalizedKey`,
  `listMappings`), mirroring `src/features/accounting/accounts.ts`.
- `classify.ts` — `classify()`, the pure matching pipeline.
- `learning.ts` — `learnMapping()`, `relearnMapping()`,
  `learnOrUpdateMapping()`; the commit-then-persist entry points.
- `index.ts` — re-exports the public surface.

## Mapping model

`item_mappings` (unchanged from Milestone 2 — no schema migration was
needed):

```sql
CREATE TABLE item_mappings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_name_normalized TEXT NOT NULL UNIQUE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

The existing `UNIQUE` constraint on `item_name_normalized` is what makes
mapping lookups and uniqueness deterministic — no schema change was
required or made. No example mappings (e.g. "fertilizer" -> some account)
are preloaded into any real seed/init path; illustrative mappings only
ever appear in tests/fixtures.

## Normalization rules (`normalizeForClassification`)

Applied to both stored mapping keys and text being classified, so the same
rules always apply on write and on read:

1. Unicode NFKC normalization.
2. Lowercasing.
3. Punctuation stripped to a space (preserves token boundaries — `"diesel,"`
   normalizes to `"diesel "`, not `"diesel"` glued to the next word).
4. Whitespace collapsed to single spaces, trimmed.
5. Each whitespace-separated token is looked up in a small static
   Hindi/Hinglish alias table and replaced with its canonical English term
   if present (see "Hindi/Hinglish aliases" below).

No embeddings, fuzzy matching, semantic similarity, LLM calls, or network
requests are used anywhere in this module. Same input + same mapping table
state -> same normalized output, always.

## Matching precedence

`classify(transaction)` matches against `transaction.description` only
(see "Field rule" below) and applies, in order:

1. **Exact normalized mapping lookup** (`match source: "exact_mapping"`):
   the whole normalized description is looked up directly against
   `item_name_normalized`. If found, that mapping's account is used.
2. **Keyword matching** (`match source: "keyword_mapping"`), only if no
   exact match: every stored mapping's key is tokenized, and a mapping is
   a candidate if its full token sequence appears as a contiguous run of
   _whole tokens_ inside the normalized description's tokens. This is
   real word/token-boundary matching, never a substring test — a mapping
   for `"oil"` will never match text containing `"soil"`, because `"soil"`
   and `"oil"` are different tokens, not because of a regex escape hack.
   Among all keyword candidates, the one(s) with the most tokens (most
   specific) win. If exactly one candidate has the maximum specificity, it
   is used. If two or more tie at the maximum specificity, the result is
   `AMBIGUOUS` (see below) — never an arbitrary pick, and the candidate
   list is built independent of the mappings' row insertion order (the
   candidate set is explicitly re-sorted by normalized key before any
   selection logic runs).
3. **No match** -> `UNKNOWN`.

### Field rule

`item_mappings` is an **item-keyed** table, so classification always
matches against `ParsedTransaction.description` (the free-text
item/purpose, e.g. "fertilizer", "diesel") — never against
`ParsedTransaction.party` (the merchant/counterparty name). If
`description` is missing or empty after normalization, classification
returns `INVALID` rather than guessing from the party field or any other
signal.

## Result model (`ClassifiedTransaction`)

A discriminated union on `status`:

- `matched` — `accountId`, `account`, `matchSource` ("exact_mapping" |
  "keyword_mapping"), the matched `mapping` row, `requiresConfirmation:
false`.
- `unknown` — no mapping found (or a matched mapping pointed at a deleted
  account); `requiresConfirmation: true`.
- `ambiguous` — two or more equally-specific keyword candidates;
  `candidates: ClassificationCandidate[]` for a future UI to disambiguate;
  `requiresConfirmation: true`.
- `invalid` — the parsed transaction had no usable description text;
  `requiresConfirmation: true`.

The original `ParsedTransaction` is included unmodified (never mutated) on
every result, and no journal lines or posting-related fields are ever
present on `ClassifiedTransaction`.

## Unknown behavior

No mapping found -> explicit `UNKNOWN` with a `reason` string. Never an
invented account, never a "Miscellaneous" fallback, never auto account
creation, never a posted entry.

## Ambiguity behavior

When deterministic keyword rules cannot safely pick a single winner (two
or more mappings tie at the highest specificity), `classify()` returns
`AMBIGUOUS` with the full candidate list (`accountId`, `account`,
`source`, `matchedKey` per candidate) instead of arbitrarily choosing the
first DB row. Resolving an ambiguous result is left to a future UI or
manual call to `learnMapping`/`relearnMapping`.

## Self-learning flow

`learnMapping(sourceKey, accountId)`:

1. Normalizes `sourceKey`; rejects (`MappingValidationError`) if it
   normalizes to an empty string.
2. Confirms `accountId` exists via the Milestone 3 `getAccount()` lookup;
   rejects (`MappingAccountNotFoundError`) if not — never auto-creates the
   account.
3. Rejects if a mapping for that normalized key already exists
   (`MappingValidationError`) — creating and updating are explicit,
   distinct operations (see "Mapping update behavior").
4. Inserts the row into `item_mappings` via the Milestone 2 `AppDatabase`
   API (`getDatabase().run(...)`).
5. Only after that SQL write succeeds does it call `persistDatabase()` —
   the same commit-then-persist discipline as
   `src/features/accounting/posting.ts`'s `postJournalEntry()`. There is
   no second persistence path and no direct IndexedDB write anywhere in
   this module.

`learnMapping` never calls `postJournalEntry()` or any other M3 operation
— learning a mapping is a distinct action from posting a transaction.

## Mapping update behavior

Updating an existing mapping to point at a different account is a
**separate, explicit** operation (`updateMapping()` /
`relearnMapping()`), never an automatic side effect of `classify()`.
`upsertMapping()` / `learnOrUpdateMapping()` provide an explicit
create-or-update convenience for callers that don't need to distinguish
the two cases; it is idempotent for a no-op (same key, same account) and
otherwise performs the same explicit update path.

Because `item_name_normalized` is `UNIQUE`, at most one mapping can ever
exist for a given normalized key — there is no legacy-conflict scenario
possible for rows written through this module's own write paths. If two
mappings' _keywords_ both match a description with equal specificity
during keyword matching, that is handled as `AMBIGUOUS` (see above), not
as a mapping-storage conflict.

## Persistence discipline

Same as Milestone 3: every mutation goes SQLite write -> (implicit
single-statement commit) -> `persistDatabase()` via the Milestone 2
`AppDatabase`/`persistence.ts` surface. `persistDatabase()` is only ever
called after a successful write. No raw IndexedDB access happens in this
module.

## The classifier never posts

`src/features/classification/` contains no import of and no call to
`postJournalEntry`, `createPurchase`, `createSale`, `createPayment`,
`createReceipt`, or any other `src/features/accounting/operations.ts`
function — verified with:

```
grep -rn "postJournalEntry\|createPurchase\|createSale\|createPayment\|createReceipt" src/features/classification
```

which returns no matches outside of explanatory comments. Classification
imports `getAccount`/`Account` from `src/features/accounting` for lookups
only, and `getDatabase`/`persistDatabase` from `src/db` for the same
commit-then-persist discipline M3 uses. It imports nothing from React,
React Router, any UI component, or any DOM-only API.

## Determinism guarantees

- Same `ParsedTransaction` + same DB state -> same `ClassifiedTransaction`,
  always (no randomness, no wall-clock dependence, no network).
- Matching never depends on `item_mappings` row insertion order: exact
  lookups use the `UNIQUE` index directly, and keyword candidates are
  explicitly re-sorted by normalized key before any tie-break logic runs.

## Hindi/Hinglish aliases

A small, explicit, static alias table (`ALIAS_TABLE` in `normalize.ts`) —
**not** translation or NLP — maps a fixed set of Hindi/Hinglish terms to
their canonical English equivalent before matching:

| Alias(es)                     | Canonical term                                             |
| ----------------------------- | ---------------------------------------------------------- |
| `khaad`, `khad`, `urvarak`    | `fertilizer`                                               |
| `beej`                        | `seeds`                                                    |
| `dawai`, `dawa`, `keetnashak` | `pesticide`                                                |
| `diesel`                      | `diesel` (identity; documents the term is supported as-is) |

Design choice: aliases are a static lookup table applied during
normalization, not separate `item_mappings` rows. This means a single
mapping created for `"fertilizer"` automatically also matches `"khaad"`,
without needing a duplicate mapping row per alias — and without any
translation/NLP model in the loop.

## What's intentionally NOT implemented

- No UI: no confirmation screens, no mapping management forms, no
  disambiguation prompts. `AMBIGUOUS`/`UNKNOWN` results carry enough
  structured data (`candidates`, `reason`) for a future UI to build on.
- No AI/embeddings/vector/fuzzy/semantic matching of any kind.
- No automatic account creation — `learnMapping` always rejects an
  unknown `accountId`.
- No posting: this module never writes to `journal_entries` or
  `journal_lines`, and never calls `postJournalEntry()`.
- No changes to the M4 parser.
