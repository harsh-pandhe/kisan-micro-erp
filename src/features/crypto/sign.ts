/**
 * Ed25519 signing (Milestone 9). Operates purely on exported backup bytes
 * — never touches SQLite, never mutates any table. See
 * docs/milestone-9.md, "Signing".
 */
import * as ed from '@noble/ed25519';
import { encodeSignedEnvelope, signedBackupFileName } from './envelope';
import { getOrCreateSigningKey, keyFingerprint } from './keys';
import { sha256Bytes, toHex } from './hash';
import { buildCanonicalPayload } from './payload';
import { CryptoError } from './types';

export { signedBackupFileName };

/** Raw building block: signs arbitrary canonical payload bytes with the given private key. */
export function signPayload(canonicalPayloadBytes: Uint8Array, privateKey: Uint8Array): Uint8Array {
  try {
    return ed.sign(canonicalPayloadBytes, privateKey);
  } catch (cause) {
    throw new CryptoError('signing-failed', 'Failed to sign the backup payload', cause);
  }
}

export interface SignedBackupResult {
  envelopeBytes: Uint8Array;
  fileName: string;
  sha256Hex: string;
  publicKeyHex: string;
  keyFingerprint: string;
}

/**
 * Produces a signed `.kmesig` backup from already-exported SQLite bytes
 * (e.g. from `exportDatabase()` in `src/features/backup`). Generates or
 * reuses the local signing key, hashes the SQLite bytes with SHA-256,
 * signs the canonical metadata+hash payload (never the SQLite bytes
 * directly), and wraps everything in the signed envelope format.
 */
export async function createSignedBackup(sqliteBytes: Uint8Array): Promise<SignedBackupResult> {
  const { privateKey, publicKey } = await getOrCreateSigningKey();
  const digest = sha256Bytes(sqliteBytes);
  const canonicalPayload = buildCanonicalPayload(digest);
  const signature = signPayload(canonicalPayload, privateKey);

  const sha256Hex = toHex(digest);
  const publicKeyHex = toHex(publicKey);
  const createdAt = new Date().toISOString();

  const envelopeBytes = encodeSignedEnvelope({
    sha256Hex,
    publicKeyHex,
    signatureHex: toHex(signature),
    createdAt,
    sqliteBytes,
  });

  return {
    envelopeBytes,
    fileName: signedBackupFileName(new Date(createdAt)),
    sha256Hex,
    publicKeyHex,
    keyFingerprint: keyFingerprint(publicKey),
  };
}

/** Wraps signed envelope bytes as a downloadable Blob. */
export function signedBackupAsBlob(bytes: Uint8Array): Blob {
  const copy = new Uint8Array(bytes);
  return new Blob([copy], { type: 'application/octet-stream' });
}

/** Standard browser download pattern, mirroring M8's `downloadBackup`. */
export function downloadSignedBackup(
  bytes: Uint8Array,
  fileName: string = signedBackupFileName(),
): void {
  const blob = signedBackupAsBlob(bytes);
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = fileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
