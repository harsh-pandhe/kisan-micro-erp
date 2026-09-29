# Phase-1 Manual QA Results

**Baseline commit tested:** `bee66d9` (branch `claude/epic-archimedes-wd0ss4`)
**Date of this QA pass:** 2026-09-29
**Environment:** headless cloud development container (no display, no
Android SDK, no Android emulator/device).

## Blocker statement

> Android Emulator / real-browser QA was **not executable** in this
> environment because Android SDK tooling (`adb`, `emulator`) and a
> running Android device/emulator are unavailable in this headless cloud
> container. `which adb emulator` returns "command not found"; no
> emulator process, AVD, or physical device is reachable.

No Android screenshots, browser DevTools captures, microphone tests, file-picker
interactions, or on-device performance numbers were produced for this
report. Every result below that depends on a real browser/device is
recorded as **BLOCKED** or **NOT VERIFIED IN SANDBOX**, never as PASS.

## What _was_ verified in this pass (see full detail in

[`docs/review-1-evidence.md`](./review-1-evidence.md))

- Baseline confirmed: `git rev-parse HEAD` → `bee66d9...`, working tree clean.
- Full automated regression: `npm run lint` (clean), `npm run format:check`
  (clean), `npm test` (274/274 passing, run twice back-to-back with
  identical results — no ordering/flakiness detected), `npm run build`
  (succeeds, no warnings).
- Production build output inspected directly: `dist/manifest.webmanifest`,
  `dist/sw.js`, `dist/workbox-9c191d2f.js`, `dist/sql-wasm.wasm`,
  `dist/pwa-192x192.png`, `dist/pwa-512x512.png`, `dist/assets/*` all
  present.
- Static client-only audit re-run: grep for `fetch(`, `XMLHttpRequest`,
  `WebSocket`, `EventSource`, `axios` across `src/` — zero matches.
  `package.json` dependencies checked — no cloud/backend SDK present.
- Static architecture audit re-run: no SQL string patterns in
  `src/pages`/`src/components`, parser has no `db`/`react` imports,
  classification module has no calls to `postJournalEntry`/
  `createPurchase`/`createSale`/`createPayment`/`createReceipt` (the one
  grep hit is a doc-comment, not a call), reports module contains no
  write/mutation SQL.
- No genuine source defects found by any automated or static check, so
  **no source code was modified** in this QA pass. This document and the
  updated evidence file are the only changes.

## Results table

| #   | Test                                                                                   | Result                                                            | Environment                                                                                                                | Evidence / Notes                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | PWA installation                                                                       | BLOCKED                                                           | Android emulator/device required                                                                                           | No Android tooling in this container                                                                                                                                                                                   |
| 2   | PWA launch (installed)                                                                 | BLOCKED                                                           | Android emulator/device required                                                                                           | Same                                                                                                                                                                                                                   |
| 3   | Offline launch (installed PWA)                                                         | BLOCKED                                                           | Android emulator/device required                                                                                           | Same                                                                                                                                                                                                                   |
| 4   | Offline typed transaction (full parser→classify→confirm→post flow)                     | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser required for UI; Vitest+jsdom+real-sql.js verifies the underlying flow                                        | See `tests/integration/phase1-regression.test.ts` for the automated equivalent                                                                                                                                         |
| 5   | Offline persistence across reload                                                      | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser required; Vitest+fake-indexeddb verifies persistence round-trip                                               | See `tests/db`, `tests/integration/large-fixture.test.ts`                                                                                                                                                              |
| 6   | Offline reports (Trial Balance/P&L/Balance Sheet reflect new data, balanced)           | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser required; report invariants proven in `tests/reports/*`                                                       | —                                                                                                                                                                                                                      |
| 7   | Unknown classification → user resolves → learns mapping                                | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser required; `tests/classification/*` covers this deterministically                                              | —                                                                                                                                                                                                                      |
| 8   | Ambiguous classification                                                               | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser required; `tests/classification/classify.test.ts` covers ambiguity                                            | —                                                                                                                                                                                                                      |
| 9   | Duplicate submission protection                                                        | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser tap-testing required; `tests/features/transactions/workflow.test.ts` asserts single journal entry per confirm | —                                                                                                                                                                                                                      |
| 10  | Account creation via UI                                                                | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser required; `tests/accounting/accounts.test.ts` covers the underlying service                                   | —                                                                                                                                                                                                                      |
| 11  | Voice input (English)                                                                  | BLOCKED                                                           | Real microphone + Android/desktop browser required                                                                         | No audio input device in this container                                                                                                                                                                                |
| 12  | Voice input (Hindi/Hinglish)                                                           | BLOCKED                                                           | Real microphone + Android/desktop browser required                                                                         | Same                                                                                                                                                                                                                   |
| 13  | Backup export (browser download flow)                                                  | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser download required; `tests/backup/export.test.ts` covers the export function                                   | —                                                                                                                                                                                                                      |
| 14  | Backup restore (valid)                                                                 | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser file-picker required; `tests/backup/restore.test.ts`, `round-trip.test.ts` cover the underlying flow          | —                                                                                                                                                                                                                      |
| 15  | Invalid/corrupt restore rejection                                                      | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser required; `tests/backup/validation.test.ts` covers rejection paths                                            | —                                                                                                                                                                                                                      |
| 16  | Signed backup export (.kmesig)                                                         | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser download required; `tests/backup/signed-export.test.ts`                                                       | —                                                                                                                                                                                                                      |
| 17  | Signed backup restore (valid signature)                                                | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser file-picker required; `tests/backup/signed-restore.test.ts`                                                   | —                                                                                                                                                                                                                      |
| 18  | Tampered signed-backup rejection                                                       | NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests | Real browser required; `tests/backup/tamper.test.ts` covers the full tamper matrix at the byte level                       | —                                                                                                                                                                                                                      |
| 19  | Network inspection (DevTools, zero app requests)                                       | NOT VERIFIED IN SANDBOX                                           | Real browser + DevTools required                                                                                           | Static grep confirms no `fetch`/`XHR`/`WebSocket` calls in source — see architecture audit above. This is source-level evidence, not a captured network trace                                                          |
| 20  | IndexedDB inspection (store separation, no private key exposure)                       | NOT VERIFIED IN SANDBOX                                           | Real browser DevTools required                                                                                             | Static code audit confirms private key lives only in its own IndexedDB store and is never written to the SQLite blob, localStorage, or any exported backup — see `docs/milestone-9.md` and `docs/review-1-evidence.md` |
| 21  | UI/touch target audit                                                                  | BLOCKED                                                           | Real device/emulator screen required                                                                                       | —                                                                                                                                                                                                                      |
| 22  | Keyboard behavior (on-screen keyboard, focus scroll)                                   | BLOCKED                                                           | Real Android device/emulator required                                                                                      | —                                                                                                                                                                                                                      |
| 23  | Browser console/runtime errors                                                         | NOT VERIFIED IN SANDBOX                                           | Real browser DevTools required                                                                                             | No console access in this headless container                                                                                                                                                                           |
| 24  | Browser-side performance (startup, DB init, posting, report query, signed backup)      | NOT VERIFIED IN SANDBOX                                           | Real browser performance tools required                                                                                    | Node/Vitest timings exist (see Performance section below) but are explicitly NOT a substitute for browser numbers                                                                                                      |
| 25  | Physical-device QA (OEM variations, real mic, real touch, battery/background behavior) | NOT TESTED                                                        | Physical Android device required                                                                                           | Not attempted; emulator QA alone (once performed) would still not satisfy this                                                                                                                                         |

**No item above is marked PASS unless it was genuinely executed.** Items
verified only at the automated-test/static-analysis level are marked
"NOT VERIFIED IN SANDBOX (browser); logic PASS via automated tests" to
make clear that the underlying logic has real test coverage even though
no real browser/device executed it.

## Performance

### Node/Vitest measurements (existing, from Milestone 10 — unchanged, not re-labeled)

Environment: Node v22.22.2, Vitest, this sandbox, measured 2026-09-25.
These are **not** browser or device measurements.

- DB init from empty: ~33 ms
- 100 sequential journal postings: ~134 ms total (~1.34 ms/entry)
- Trial Balance query: ~1.9 ms
- Unsigned backup export: ~1.3 ms
- Signed-backup sign (SHA-256 + Ed25519): ~39 ms
- Signed-backup verify: ~8 ms

### Android/browser measurements

**NOT VERIFIED IN SANDBOX.** No real browser or device is available in
this container. See the future execution procedure below for how to
obtain these using Chrome's Performance panel / `performance.now()`
instrumentation on an actual Android emulator or device.

## Future execution procedure

### Environment setup (not executed here — for a future environment with Android tooling)

```
# Confirm tooling
adb devices
emulator -list-avds

# Start an existing AVD (replace <avd-name>)
emulator -avd <avd-name> &

# Wait for boot
adb wait-for-device
adb shell 'while [ "$(getprop sys.boot_completed | tr -d "\r")" != "1" ]; do sleep 1; done'

# Build and serve the production app
npm run build
npm run preview -- --host 127.0.0.1 --port 4173

# Forward the port into the emulator's network namespace
adb reverse tcp:4173 tcp:4173

# From the emulator's browser, navigate to:
#   http://localhost:4173/
```

Label: **"Future execution procedure" — none of the above commands were
run in this session.**

### Manual QA test sequence (to run once Android tooling is available)

**PWA**

1. Open the production app in Chrome on the emulator/device.
2. Verify the app loads (Dashboard renders, no blank screen).
3. Install the PWA via the browser's install prompt.
4. Relaunch the installed app from the home screen.
5. Navigate Dashboard → Transactions → Accounts → Reports → Settings.

**Offline** 6. With network on, load the app once (primes the service-worker cache). 7. Disable emulator/device network (airplane mode or emulator network
controls — not just stopping the host preview server). 8. Relaunch the installed app. 9. Verify all five pages still render. 10. Enter a typed transaction, e.g. "Paid ₹500 cash for fertilizer". 11. Verify parser result and classification result display correctly. 12. Tap "Record Transaction" and confirm explicitly. 13. Verify success state appears only after posting completes. 14. Close and reopen the app. 15. Verify the transaction still appears in history. 16. Open Reports and verify Trial Balance/P&L/Balance Sheet reflect it
and Trial Balance/Balance Sheet are balanced.

**Classification** 17. Enter an unmapped item, e.g. "Paid ₹750 for tractor maintenance". 18. Verify UNKNOWN state; select an existing account. 19. Opt in to "remember this" (learnMapping). 20. Repeat the same item text. 21. Verify it now classifies automatically (MATCHED) using the learned mapping. 22. Use a known ambiguous input from `tests/classification/classify.test.ts`
fixtures and verify candidates are shown, nothing posts until resolved.

**Safety** 23. Prepare a valid transaction and tap "Record Transaction" rapidly
multiple times. 24. Verify the button disables during posting and exactly one transaction
/ journal entry is created (check history).

**Accounts** 25. Create a new account via the Accounts page form. 26. Reload the app. 27. Verify the account persists and appears in the list.

**Voice** 28. Tap the microphone button, grant permission, speak an English
transaction phrase. 29. Repeat in Hindi/Hinglish if the browser's recognition supports it. 30. Verify the transcribed text flows through the exact same parser/
classifier/confirmation path as typed input. 31. Do not claim voice input works offline — browser SpeechRecognition
may depend on a cloud service depending on browser/platform.

**Backup** 32. Export an unsigned backup from Settings; verify the browser download
triggers and the file matches the documented `.sqlite` naming
convention. 33. Change local data (add another transaction). 34. Restore the earlier backup via the file picker, review the
validation/confirmation state, confirm restore. 35. Verify the restored state (pre-change data) is back. 36. Reload the app. 37. Verify the restored state persists across reload.

**Signed backup** 38. Export a signed `.kmesig` backup from Settings. 39. Restore it via the file picker; verify "Signature verified" and
"SQLite validation passed" states appear before restore completes. 40. Make a copy of the valid `.kmesig` file and flip one byte. 41. Attempt to restore the tampered file. 42. Verify restore is rejected (signature invalid) and no database
replacement occurs. 43. Reload and verify the existing (pre-tamper-attempt) data is
unchanged.

**Network** 44. Open Chrome DevTools (via `chrome://inspect/#devices` from the host
if remote debugging is available) and inspect the Network panel
during the full typed-transaction → classify → confirm → report →
backup flow. 45. Verify zero application backend/API requests. (Note: this is
distinct from step 28-31's browser-native speech recognition, which
may itself make a network request as part of the browser's own
implementation — that is not an application backend call.)

**Storage** 46. Inspect IndexedDB via DevTools → Application → IndexedDB. 47. Confirm the SQLite blob store exists and holds the persisted
database. 48. Confirm the signing-key store is a separate object store and that no
private key bytes are visible in any exported backup file opened in
a hex viewer or text editor.

**UI** 49. Check touch target sizes on all five pages (buttons, inputs, nav). 50. Test on-screen keyboard behavior: does it obscure the "Record
Transaction" button? Does the view scroll to keep the focused input
visible? 51. Test horizontal scrolling on Reports tables at emulator screen width. 52. Test portrait orientation (default). 53. Test landscape orientation if practical; verify the app remains
usable (not necessarily redesigned for landscape). 54. Inspect the browser console throughout for unhandled exceptions,
WASM load failures, IndexedDB errors, service-worker errors, or React
runtime errors.

### Evidence capture plan (for the future execution above)

Suggested directory layout once real evidence exists:

```
qa/review-1/
    screenshots/
        01-pwa-launch.png
        02-pwa-installed.png
        03-offline-launch.png
        04-offline-transaction.png
        05-persistence-after-reload.png
        06-trial-balance.png
        07-profit-loss.png
        08-balance-sheet.png
        09-unknown-classification.png
        10-learned-classification.png
        11-voice-input.png
        12-backup-export.png
        13-signed-backup.png
        14-signature-verified.png
        15-tampered-backup-rejected.png
        16-network-evidence.png
        17-indexeddb-evidence.png
    logs/
    performance/
    README.md
```

None of these files exist yet — this is a naming/organization plan for
whoever runs the procedure above, not evidence produced in this session.
Screenshots must never contain private key bytes; a screenshot showing
IndexedDB store names and non-secret metadata (public key, fingerprint)
is sufficient for step 47-48.

## Physical-device distinction

Even after a successful Android **emulator** run, that alone would not
justify claiming "works on all Android phones" or "fully real-device
verified." An emulator cannot fully validate physical microphone
hardware, real touch behavior, OEM-specific Android modifications,
battery/background process behavior, or real device storage quirks.
Physical-device QA remains a separate, still-required step after
emulator QA succeeds.

## Summary

- **Automated QA (this pass):** lint clean, format clean, 274/274 tests
  passing (run twice, no flakiness), production build succeeds with all
  expected PWA assets present, static client-only and architecture audits
  clean, no genuine source bugs found.
- **Android/browser/device QA:** BLOCKED in this environment — no Android
  SDK, `adb`, `emulator`, or running device/emulator available. A complete
  manual execution procedure (54 steps across 9 categories, plus an
  evidence capture plan) is documented above for the next environment
  that has Android tooling.
- **No source code was changed** as part of this QA pass — only this
  document and the cross-reference in `docs/review-1-evidence.md` (see
  next section) were added/updated.
