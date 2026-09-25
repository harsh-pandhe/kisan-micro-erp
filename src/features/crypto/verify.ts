/**
 * Signed backup verification (Milestone 9). Crypto verification runs
 * FIRST; it never replaces Milestone 8's SQLite integrity/schema
 * validation — callers must still run that afterwards (see
 * `src/features/backup`). See docs/milestone-9.md, "Signature
 * verification algorithm".
 */
import * as ed from '@noble/ed25519';
import { parseSignedEnvelope } from './envelope';
import { fromHex, sha256Bytes, toHex } from './hash';
import { keyFingerprint } from './keys';
import { buildCanonicalPayload } from './payload';
import {
  CRYPTO_APP_ID,
  CRYPTO_FORMAT_VERSION,
  SIGNED_BACKUP_FORMAT_VERSION,
  type SignedBackupVerification,
} from './types';

/** Low-level: verifies a raw Ed25519 signature against a payload and public key. Never throws — maps library exceptions to `false`. */
export function verifySignature(
  signature: Uint8Array,
  canonicalPayloadBytes: Uint8Array,
  publicKey: Uint8Array,
): boolean {
  try {
    return ed.verify(signature, canonicalPayloadBytes, publicKey);
  } catch {
    return false;
  }
}

/**
 * Full verification pipeline for a `.kmesig` file's raw bytes:
 *
 * 1. Parse the envelope (magic, length prefix, header JSON). Malformed
 *    input at this stage -> `MALFORMED_BACKUP`.
 * 2. Validate `formatVersion`/`cryptoFormatVersion` are supported ->
 *    otherwise `UNSUPPORTED_VERSION`.
 * 3. Validate the app identifier matches -> otherwise `INVALID_FORMAT`.
 * 4. Recompute SHA-256 over the extracted SQLite bytes and compare to the
 *    embedded hash -> mismatch is `INVALID_HASH`.
 * 5. Rebuild the exact canonical payload (metadata + embedded hash bytes)
 *    and verify the Ed25519 signature against the embedded public key ->
 *    failure is `INVALID_SIGNATURE`.
 * 6. Only if every step passes: `VALID`, carrying the verified SQLite
 *    bytes for the caller to hand to M8's `validateCandidateDatabase`.
 *
 * This function never throws — every failure path, including any
 * unexpected exception from the underlying crypto libraries, is caught
 * and mapped to a typed result.
 */
export function verifySignedBackup(fileBytes: Uint8Array): SignedBackupVerification {
  try {
    const parsed = parseSignedEnvelope(fileBytes);
    if (!parsed.ok) {
      return { status: 'MALFORMED_BACKUP', message: parsed.reason };
    }
    const { header, sqliteBytes } = parsed;

    if (
      header.formatVersion > SIGNED_BACKUP_FORMAT_VERSION ||
      header.cryptoFormatVersion > CRYPTO_FORMAT_VERSION
    ) {
      return {
        status: 'UNSUPPORTED_VERSION',
        message: `Signed backup format version ${header.formatVersion}/${header.cryptoFormatVersion} is newer than this app supports`,
      };
    }
    if (header.formatVersion < 1 || header.cryptoFormatVersion < 1) {
      return {
        status: 'UNSUPPORTED_VERSION',
        message: 'Signed backup format version is not recognized',
      };
    }

    if (header.appId !== CRYPTO_APP_ID) {
      return {
        status: 'INVALID_FORMAT',
        message: `Signed backup app identifier "${header.appId}" does not match this app`,
      };
    }

    let embeddedDigest: Uint8Array;
    let embeddedPublicKey: Uint8Array;
    let signature: Uint8Array;
    try {
      embeddedDigest = fromHex(header.sha256);
      embeddedPublicKey = fromHex(header.publicKey);
      signature = fromHex(header.signature);
    } catch (cause) {
      return {
        status: 'MALFORMED_BACKUP',
        message: `Header fields are not valid hex: ${String(cause)}`,
      };
    }
    if (
      embeddedDigest.length !== 32 ||
      embeddedPublicKey.length !== 32 ||
      signature.length !== 64
    ) {
      return { status: 'MALFORMED_BACKUP', message: 'Header fields have an unexpected length' };
    }

    const actualDigest = sha256Bytes(sqliteBytes);
    if (toHex(actualDigest) !== toHex(embeddedDigest)) {
      return {
        status: 'INVALID_HASH',
        message: 'Recomputed SHA-256 of the SQLite payload does not match the embedded hash',
      };
    }

    const canonicalPayload = buildCanonicalPayload(
      embeddedDigest,
      header.cryptoFormatVersion,
      header.appId,
    );
    const signatureValid = verifySignature(signature, canonicalPayload, embeddedPublicKey);
    if (!signatureValid) {
      return {
        status: 'INVALID_SIGNATURE',
        message: 'Ed25519 signature does not verify against the embedded public key',
      };
    }

    return {
      status: 'VALID',
      hashValid: true,
      signatureValid: true,
      publicKeyHex: header.publicKey,
      keyFingerprint: keyFingerprint(embeddedPublicKey),
      createdAt: header.createdAt,
      sqliteBytes,
    };
  } catch (cause) {
    // Defensive: never let a raw @noble exception (or any other bug in
    // this pipeline) escape to callers as an uncaught error.
    return {
      status: 'MALFORMED_BACKUP',
      message: `Unexpected error while verifying signed backup: ${String(cause)}`,
    };
  }
}
