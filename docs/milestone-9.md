# Milestone 9 — Local SHA-256 Hashing + Ed25519 Signed Backups

Scope: local, offline SHA-256 hashing and Ed25519 signing/verification for
exported backups, layered on top of Milestone 8's export/restore flow. No
cloud key management, no WebAuthn, no TPM/HSM, no authentication, no
password-based encryption, no CRDT/sync, no automatic backups, no key
rotation infrastructure — those are all explicitly out of scope (see
"Deferred" below).

## Libraries

`@noble/hashes` (SHA-256) and `@noble/ed25519` (Ed25519 signatures) — both
already present in `package.json` as of this milestone. Pure JS, no
Node-only APIs, no network calls, browser-compatible; confirmed by
`npm run build` producing a working Vite bundle.

`@noble/ed25519` v3 no longer bundles a hash implementation — it requires
wiring a synchronous SHA-512 into `ed.hashes.sha512` before calling any
synchronous `sign`/`verify`/`getPublicKey`. `src/features/crypto/keys.ts`
does this once, at module load, using `@noble/hashes`' `sha512`.

## SHA-256 (`src/features/crypto/hash.ts`)

**Canonical internal representation:** `Uint8Array` for every digest that
is computed or compared; a lowercase hex string only at the edges (the
signed envelope's JSON header, and any display text). `sha256Bytes()`
returns the raw digest; `sha256Hex()` returns its hex encoding via
`bytesToHex`. Hashing always operates on the exact backup payload bytes —
never a re-encoded or re-serialized copy, and never a hash of a JSON
object.

## Canonical signed payload (`src/features/crypto/payload.ts`)

This is the exact byte sequence that gets Ed25519-signed — small,
unambiguous, and built by fixed-order manual concatenation (no
`JSON.stringify`, whose key order is not guaranteed):

```
offset  size  field
0       4     cryptoFormatVersion (uint32 LE)
4       4     appId byte length N (uint32 LE)
8       N     appId (UTF-8 bytes)
8+N     32    SHA-256 digest of the SQLite payload bytes (NOT the bytes themselves)
```

Total length = `8 + N + 32`. Signing the SHA-256 digest instead of the raw
(potentially multi-megabyte) SQLite bytes keeps the signed payload small
and the signature check independent of the SQLite bytes' size — but the
digest is exactly what the verifier will recompute over the actual SQLite
bytes, so both stay bound together (see "Signature verification" below).

## Signed backup file format (`src/features/crypto/envelope.ts`)

A distinct, explicit format from Milestone 8's plain `.sqlite` files. A
`.kmesig` file is never reinterpreted as an unsigned backup and vice
versa; `looksLikeSignedEnvelope()` sniffs the magic prefix so the restore
flow picks the right path regardless of file extension.

```
offset  size  field
0       4     magic bytes "KMES" (0x4b 0x4d 0x45 0x53)
4       4     header length H, uint32 LE
8       H     header: UTF-8 JSON (see below)
8+H     ...   raw SQLite payload bytes (rest of file)
```

Header JSON shape:

```json
{
  "formatVersion": 1,
  "cryptoFormatVersion": 1,
  "appId": "kisan-micro-erp",
  "sha256": "<64 lowercase hex chars>",
  "publicKey": "<64 lowercase hex chars>",
  "signature": "<128 lowercase hex chars>",
  "createdAt": "<ISO 8601 timestamp>"
}
```

**Filename convention:** `kisan-micro-erp-signed-backup-<ISO-timestamp>.kmesig`,
mirroring M8's `.sqlite` naming but with a distinct extension.

`SIGNED_BACKUP_FORMAT_VERSION` (envelope layout) and `CRYPTO_FORMAT_VERSION`
(canonical payload layout) are versioned independently and are both bumped
only when their respective contracts change. A file whose stamped version
is newer than what the running app supports is rejected outright
(`UNSUPPORTED_VERSION`) — never guessed at or auto-migrated.

## Ed25519 key generation (`src/features/crypto/keys.ts`)

`getOrCreateSigningKey()` generates a fresh 32-byte private key
(`ed.utils.randomSecretKey()`) and derives its public key
(`ed.getPublicKey()`) **once**, on first use, and persists it — it never
regenerates on every app start. Keys are never hard-coded or deterministic.

`generateNewSigningKey()` is the one explicit, minimal reset action
(Settings → "Generate new signing key"). It requires the caller to obtain
confirmation first (the UI shows a `window.confirm` warning) and never
runs automatically. It does **not** retroactively invalidate old
signatures — they remain valid and stay tied to the old public key
forever; only future signing uses the new key.

## Private-key storage (`src/features/crypto/keys.ts`)

The private key lives in a **dedicated IndexedDB database**
(`kisan-micro-erp-crypto`, object store `signing-keys`) — entirely
separate from M2's `kisan-micro-erp` SQLite-blob database and from
`localStorage`. It is never written to the SQLite database, never logged,
and never included in any exported backup file (verified by
`tests/backup/signed-export.test.ts`, which asserts the raw private-key
bytes never appear in an exported envelope's bytes).

**Key loss:** if the browser's IndexedDB store is cleared (e.g. "Clear
browsing data"), the private key is gone permanently. There is no key
recovery in Phase 1 — a new key must be generated, and it will not be able
to reproduce old signatures.

## Public key and fingerprint

The public key MAY be embedded in a signed backup (`publicKey` field, hex)
— it must be, for verification to be possible from the file alone. The
**key fingerprint** is the first 16 hex characters of
`SHA-256(publicKey)`, exposed as `keyFingerprint()`. It is shown in the
Settings UI and in restore-preview text; the private key is never shown
anywhere.

## Signing (`src/features/crypto/sign.ts`)

`createSignedBackup(sqliteBytes)`:

1. `getOrCreateSigningKey()` — reuses or creates the local identity.
2. `sha256Bytes(sqliteBytes)` — hashes the exact SQLite payload bytes.
3. `buildCanonicalPayload(digest)` — the fixed-layout bytes from above.
4. `ed.sign(canonicalPayload, privateKey)` — the actual Ed25519 signature.
5. `encodeSignedEnvelope(...)` — wraps everything into the `.kmesig` file.

Signing operates purely on already-exported bytes; it never touches any
SQLite table (no writes to `journal_entries`, `transactions`, `accounts`,
or anywhere else) and never mutates the live database or IndexedDB
persistence — verified by `tests/backup/signed-export.test.ts`.

## Signature verification (`src/features/crypto/verify.ts`)

`verifySignedBackup(fileBytes)` never throws; every failure path,
including any unexpected exception from the underlying `@noble` libraries,
is caught and mapped to a typed, discriminated result: `VALID` |
`INVALID_HASH` | `INVALID_SIGNATURE` | `INVALID_FORMAT` |
`UNSUPPORTED_VERSION` | `MALFORMED_BACKUP`.

Order of checks:

1. Parse the envelope (magic bytes, length prefix, header JSON) —
   malformed input at this stage → `MALFORMED_BACKUP`.
2. Validate `formatVersion` / `cryptoFormatVersion` are supported (not
   newer than this app's) → otherwise `UNSUPPORTED_VERSION`.
3. Validate the embedded `appId` matches `kisan-micro-erp` → otherwise
   `INVALID_FORMAT`.
4. Recompute SHA-256 over the extracted SQLite bytes and compare to the
   embedded hash → mismatch → `INVALID_HASH`.
5. Rebuild the exact canonical payload (metadata + the embedded hash
   bytes) and verify the Ed25519 signature against the embedded public
   key → failure → `INVALID_SIGNATURE`.
6. Only if every step passes: `VALID`, carrying the verified SQLite bytes.

**Crypto verification never replaces Milestone 8's SQLite validation.**
`restoreSignedDatabase()` (`src/features/backup/import.ts`) runs crypto
verification first and, only on `VALID`, hands the extracted SQLite bytes
to M8's existing `restoreDatabase()`, which re-runs
`validateCandidateDatabase()` (integrity_check, foreign_key_check,
required tables, format version) before ever calling `replaceDatabase()` +
`persistDatabase()`. A failure at any stage — crypto or SQLite — throws
before the active database is touched.

## Restore verification order

```
file bytes
  -> envelope parse (magic / length prefix / header JSON)
  -> [signed only] crypto verification (hash + Ed25519 signature)
  -> SQLite open in an isolated instance
  -> PRAGMA integrity_check
  -> PRAGMA foreign_key_check
  -> schema / backup_format_version validation
  -> only then: replaceDatabase() + persistDatabase()
```

This reuses M8's existing atomic-restore safety guarantees unchanged
(`openCandidateDatabase`, `validateCandidateDatabase`, `replaceDatabase`) —
M9 does not reimplement or weaken them.

## Unsigned-backup compatibility

Milestone 8's plain `.sqlite` backups are fully supported, unchanged.
`looksLikeSignedEnvelope()` distinguishes the two formats by the `.kmesig`
magic prefix, so the restore flow picks the right path automatically. An
unsigned backup is never silently "upgraded" or re-signed on import.

**Unsigned backups get SQLite/schema integrity validation only — no
authenticity or tamper-evidence.** Anyone with write access to the file
between export and import can modify an unsigned backup undetected;
nothing in M8 or M9 claims otherwise. Signed backups get both integrity
validation and cryptographic tamper-evidence.

## No encryption claim

Ed25519 signatures provide **authenticity and integrity** — proof the
file matches what was signed and hasn't been altered — **not
confidentiality**. A signed backup's SQLite payload remains fully
readable by any SQLite tool; nothing in this milestone encrypts it. UI
copy and this document deliberately avoid the words "encrypted" or
"secret" for signed backups.

## Threat model

**Protects against:**

- Accidental corruption or truncation of a backup file in transit or storage.
- Tampering with the SQLite payload bytes after signing (`INVALID_HASH`).
- Tampering with the signed metadata — format version, app id, embedded
  hash — since all of it is part of the signed canonical payload
  (`INVALID_SIGNATURE`).
- A backup claiming to be signed by a key it was not actually signed with
  (wrong-key verification fails).

**Does NOT protect against:**

- A compromised browser, device, or malware with access to the running
  page or its IndexedDB storage.
- Theft of the private key from the device (no hardware-backed key, no
  TPM/HSM/WebAuthn in Phase 1).
- A user deleting their own key (IndexedDB store cleared) — this is
  unrecoverable data loss for that identity, not an attack.
- Proof of real-world identity behind a public key: Ed25519 proves the
  backup was signed by _the holder of the corresponding private key_, not
  that the key belongs to any specific person or organization. There is
  no PKI or trust chain in Phase 1.
- Confidentiality of the backup's contents (see "No encryption claim").

## Offline / browser guarantees

Every operation in `src/features/crypto` and the signed-backup additions
to `src/features/backup` is pure client-side JS: `@noble/hashes` and
`@noble/ed25519`, `idb` for the dedicated key store, and standard
Blob/File/IndexedDB browser APIs. No `fetch`, `XMLHttpRequest`, or any
other network call exists anywhere in this code path (grep-verified), and
no `node:crypto` or other Node-only API is used (grep-verified;
`npm run build` also confirms the Vite/browser bundle builds cleanly).

## Deferred (explicitly out of scope for Milestone 9)

- Cloud KMS / server-side key management.
- Hardware-backed keys, TPM/HSM, WebAuthn/passkeys.
- Encryption of backup contents (confidentiality).
- Key rotation infrastructure / key history (only a minimal, explicit,
  confirmed "generate new key" reset action exists).
- Any form of authentication, password protection, or access control.
- CRDT/sync, automatic/scheduled backups.

## Files

- `src/features/crypto/types.ts` — error types, format version constants, result types.
- `src/features/crypto/hash.ts` — SHA-256 via `@noble/hashes`.
- `src/features/crypto/keys.ts` — Ed25519 key generation, dedicated IndexedDB storage, fingerprint.
- `src/features/crypto/payload.ts` — canonical signed-payload byte layout.
- `src/features/crypto/envelope.ts` — `.kmesig` file format encode/parse.
- `src/features/crypto/sign.ts` — signing + signed backup construction + download.
- `src/features/crypto/verify.ts` — full verification pipeline.
- `src/features/backup/export.ts` — `exportSignedDatabase()`, `downloadSignedDatabaseBackup()`.
- `src/features/backup/import.ts` — `validateSignedBackupAndSummarize()`, `restoreSignedDatabase()`.
- `src/components/BackupRestore.tsx` — signed export button, signed/unsigned restore detection and UI.
- `src/components/SigningKeyStatus.tsx` — Settings key status, fingerprint, key reset.
- `tests/crypto/*.test.ts`, `tests/backup/{signed-export,signed-restore,tamper}.test.ts`.

## What was and wasn't tested

All correctness claims above are backed by the automated real-crypto test
suite (`tests/crypto/*`, `tests/backup/signed-export.test.ts`,
`tests/backup/signed-restore.test.ts`, `tests/backup/tamper.test.ts`) —
real `@noble/hashes`/`@noble/ed25519` implementations throughout, no
mocked cryptography, plus `fake-indexeddb` for the dedicated key store.
Real-browser interaction (the native file picker, an actual downloaded
file re-imported by hand, a real IndexedDB "clear site data") was **not**
exercised — this milestone was built and verified in a headless sandbox,
and that class of manual QA is still needed before shipping.
