# Review-1 Evidence Plan

How Phase 1 will be demonstrated at review. This is a plan, not results —
each item below gets filled in with actual numbers/screenshots once
Milestones 1-9 are done. No claim here is made until it has been measured.

## 1. Airplane mode / zero-network demonstration

- Load the deployed PWA once online (installs the service worker + precache).
- Enable device airplane mode.
- Reopen the app from the home screen icon.
- Perform a full flow: enter a transaction → classify → post → view Trial
  Balance — entirely offline.

## 2. Network tab showing zero application requests

- Browser DevTools → Network tab, filtered to the app's origin.
- Reload the app while offline; show zero failed/pending requests (the
  service worker serves everything from cache).

## 3. SQLite-WASM operation

- DevTools console: run a read query against the live sql.js instance
  (e.g. `SELECT count(*) FROM journal_lines`) and show a result, proving
  SQLite is running client-side, not fetched from a server.

## 4. IndexedDB persistence

- DevTools → Application → IndexedDB: show the serialized database blob.
- Reload the page; show the same transaction history is still present
  (proves the sql.js state survived a reload via IndexedDB, not memory).

## 5. Transaction entry

- Screen recording: type (or speak) a transaction phrase, show it parsed,
  classified, and posted as a journal entry.

## 6. Debit = Credit

- For the posted entry above, show the `journal_lines` rows and that
  `SUM(debit) = SUM(credit)`, either via a UI voucher view or a direct query.
- Show at least one unit test asserting this invariant across all voucher
  types (`docs/accounting-model.md`).

## 7. SHA-256 hash

- Export a backup file; show its SHA-256 hash computed in-app.
- Independently recompute the hash of the exported file (e.g. via a CLI
  `sha256sum`) and show it matches.

## 8. Ed25519 signature

- Show the signature attached to the export, and a verification step
  (in-app or scripted) confirming the signature is valid for that exact
  file and the on-device public key.

## 9. Basic performance measurements

- Report actual, measured numbers only, e.g.: time to parse N sample
  phrases, time to post a journal entry, time to load the app from a cold
  service-worker cache, on a specific test device.
- Do not state or imply guarantees ("sub-millisecond", "institutional-grade",
  "tamper-proof", memory limits) that have not been benchmarked and verified
  on the actual target hardware.
