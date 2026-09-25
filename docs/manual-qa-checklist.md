# Manual QA Checklist — Phase 1 / Review 1

Concrete checklist for a human tester on a real device/browser. Every item
is labeled automated / manual / not-tested-in-sandbox. Items marked
**not-tested-in-sandbox** genuinely require a real browser or device and
were not executed by the audit that produced this file — see
`docs/review-1-evidence.md` for what was verified by reading code and
running the automated suite instead.

## Devices/browsers

- [ ] Desktop Chrome (latest) — not-tested-in-sandbox
- [ ] Android Chrome (latest) — not-tested-in-sandbox
- [ ] (Optional, best-effort) Desktop Safari/Firefox — not-tested-in-sandbox

## PWA install

- [ ] Install prompt appears / "Add to Home Screen" works on Android Chrome — not-tested-in-sandbox
- [ ] Installed app launches standalone (no browser chrome) — not-tested-in-sandbox
- [ ] App icon and name match `manifest.webmanifest` — manual (verified webmanifest content by reading the built file; icon rendering itself is not-tested-in-sandbox)

## Offline navigation

- [ ] Reload the installed app in airplane mode — app shell loads from cache — not-tested-in-sandbox
- [ ] Navigate between Dashboard / Transactions / Reports / Accounts / Settings while offline — not-tested-in-sandbox
- [ ] DevTools Network tab shows zero requests to any API origin, online or offline — not-tested-in-sandbox (code-level zero-network confirmed by grep, automated)

## Core transaction workflow

- [ ] Type a transaction phrase → parses correctly → not-tested-in-sandbox (parsing logic itself is automated, see `tests/parser/`)
- [ ] Classification suggests the learned account, or offers UNKNOWN resolution — not-tested-in-sandbox (logic automated, see `tests/classification/`)
- [ ] Explicit Confirm button required before posting; nothing posts on parse/classify alone — automated (`tests/features/transactions/workflow.test.ts`, `tests/integration/phase1-regression.test.ts`) + manual code read of `TransactionReview.tsx`/`TransactionInput.tsx` confirming the confirm gate
- [ ] Posted transaction appears in History — automated
- [ ] Trial Balance / P&L / Balance Sheet reflect the new posting — automated

## Close/reopen persistence

- [ ] Enter a transaction, fully close the browser tab/app, reopen — data still present — not-tested-in-sandbox on a real browser; automated equivalent exists (`tests/db/persistence.test.ts`, `tests/features/transactions/workflow.test.ts` close+reopen the sql.js singleton against `fake-indexeddb`)

## Voice input

- [ ] Microphone permission prompt appears appropriately — not-tested-in-sandbox
- [ ] Hindi speech recognized (where supported by the browser) — not-tested-in-sandbox
- [ ] English speech recognized — not-tested-in-sandbox
- [ ] On a browser without `SpeechRecognition` support, the mic button is hidden/disabled and typed entry still works — not-tested-in-sandbox (fallback code path exists in `VoiceInputButton.tsx`; UI copy audited to not overclaim — see below)

## File operations

- [ ] Backup file downloads to the device (unsigned `.sqlite`, signed `.kmesig`) — not-tested-in-sandbox
- [ ] File picker opens and accepts a previously exported backup for restore — not-tested-in-sandbox
- [ ] Restore requires an explicit confirmation step before it replaces data — automated (`tests/backup/restore.test.ts`) + manual code read
- [ ] A failed/tampered restore shows a clear error and never a success message — automated (`tests/backup/tamper.test.ts`, `tests/backup/validation.test.ts`) + manual code read of the restore UI's error/success state transitions
- [ ] Signed backup verification result (valid/invalid) is shown clearly before restoring — not-tested-in-sandbox for the UI rendering; the underlying verification is automated

## UI/UX spot checks (manual code review performed this audit)

- [ ] Touch targets on buttons/nav are reasonably sized — manual (reviewed `Button.css`, `BottomNavigation.css`)
- [ ] Error messages are specific, not generic "Something went wrong" — manual (reviewed error copy in `TransactionInput.tsx`, `BackupRestore.tsx`)
- [ ] Loading/disabled states prevent duplicate submission — automated/manual (`recordTransaction` in-flight disable pattern confirmed in `TransactionInput.tsx`/`TransactionReview.tsx`)
- [ ] Currency formatting is consistent (₹, 2 decimal places) across History, Reports, Review — manual (all four money-formatting call sites use the same `(minor / 100).toFixed(2)` pattern: `formatMinor.ts`, `TransactionHistory.tsx`, `ParseResultCard.tsx`, `TransactionReview.tsx`)
- [ ] Tables don't break layout on narrow screens — not-tested-in-sandbox (no real narrow viewport available; `ReportTable.css` reviewed for overflow handling)

## Known limitation on voice-input claims

Any UI copy or docs claiming voice input is "fully offline" or "audio
never leaves the device" would overclaim, since `SpeechRecognition`
behavior (on-device vs. cloud-assisted) is browser/platform-defined and
outside this app's control. This audit checked `VoiceInputButton.tsx` and
`docs/milestone-6.md` for such claims; no overclaiming language was found
as of this audit (2026-09-25) — the docs already frame typed entry as the
guaranteed offline path and voice as best-effort/browser-dependent.
