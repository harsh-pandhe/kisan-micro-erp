/**
 * Signed backup envelope: a self-describing container that pairs a JSON
 * header (metadata + hash + signature + public key) with the raw SQLite
 * bytes. See docs/milestone-9.md, "Signed backup file format" for the
 * exact byte layout this module implements.
 *
 * Layout:
 *
 *   offset  size  field
 *   0       4     magic bytes "KMES" (0x4b 0x4d 0x45 0x53)
 *   4       4     header length in bytes, uint32 LE
 *   8       H     header, UTF-8 JSON (H = previous field)
 *   8+H     ...   raw SQLite payload bytes (the rest of the file)
 *
 * The header JSON has the shape `SignedBackupHeaderJson` below. This is a
 * distinct format/version from Milestone 8's plain `.sqlite` files —
 * unsigned files are never reinterpreted as signed, and vice versa.
 */
import {
  CRYPTO_APP_ID,
  CRYPTO_FORMAT_VERSION,
  SIGNED_BACKUP_FORMAT_VERSION,
  SIGNED_ENVELOPE_MAGIC,
} from './types';

interface SignedBackupHeaderJson {
  formatVersion: number;
  cryptoFormatVersion: number;
  appId: string;
  sha256: string;
  publicKey: string;
  signature: string;
  createdAt: string;
}

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export interface EncodeEnvelopeInput {
  sha256Hex: string;
  publicKeyHex: string;
  signatureHex: string;
  createdAt: string;
  sqliteBytes: Uint8Array;
}

/** `kisan-micro-erp-signed-backup-2026-09-24T101530.kmesig` — mirrors M8's naming, distinct extension. */
export function signedBackupFileName(now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, '').replace('Z', '');
  return `kisan-micro-erp-signed-backup-${stamp}.kmesig`;
}

/** Builds the full `.kmesig` envelope bytes from a header and the raw SQLite payload. */
export function encodeSignedEnvelope(input: EncodeEnvelopeInput): Uint8Array {
  const header: SignedBackupHeaderJson = {
    formatVersion: SIGNED_BACKUP_FORMAT_VERSION,
    cryptoFormatVersion: CRYPTO_FORMAT_VERSION,
    appId: CRYPTO_APP_ID,
    sha256: input.sha256Hex,
    publicKey: input.publicKeyHex,
    signature: input.signatureHex,
    createdAt: input.createdAt,
  };
  const headerBytes = textEncoder.encode(JSON.stringify(header));
  const lengthPrefix = new Uint8Array(4);
  new DataView(lengthPrefix.buffer).setUint32(0, headerBytes.length, true);

  const out = new Uint8Array(
    SIGNED_ENVELOPE_MAGIC.length +
      lengthPrefix.length +
      headerBytes.length +
      input.sqliteBytes.length,
  );
  let offset = 0;
  out.set(SIGNED_ENVELOPE_MAGIC, offset);
  offset += SIGNED_ENVELOPE_MAGIC.length;
  out.set(lengthPrefix, offset);
  offset += lengthPrefix.length;
  out.set(headerBytes, offset);
  offset += headerBytes.length;
  out.set(input.sqliteBytes, offset);
  return out;
}

export type EnvelopeParseResult =
  | { ok: true; header: SignedBackupHeaderJson; sqliteBytes: Uint8Array }
  | { ok: false; reason: string };

/**
 * Parses raw file bytes as a `.kmesig` envelope. Never throws — every
 * failure mode (too short, bad magic, corrupt length prefix, truncated
 * header, unparsable JSON, missing/malformed fields) is reported as a
 * typed `{ ok: false }` result so callers can map it to a `MALFORMED_BACKUP`
 * verification outcome without leaking a raw parser exception.
 */
export function parseSignedEnvelope(bytes: Uint8Array): EnvelopeParseResult {
  if (bytes.length < SIGNED_ENVELOPE_MAGIC.length + 4) {
    return { ok: false, reason: 'File is too short to be a signed backup' };
  }
  for (let i = 0; i < SIGNED_ENVELOPE_MAGIC.length; i++) {
    if (bytes[i] !== SIGNED_ENVELOPE_MAGIC[i]) {
      return { ok: false, reason: 'Missing signed-backup magic bytes' };
    }
  }
  const lengthOffset = SIGNED_ENVELOPE_MAGIC.length;
  let headerLength: number;
  try {
    headerLength = new DataView(bytes.buffer, bytes.byteOffset + lengthOffset, 4).getUint32(
      0,
      true,
    );
  } catch (cause) {
    return { ok: false, reason: `Corrupt header length prefix: ${String(cause)}` };
  }
  const headerStart = lengthOffset + 4;
  const headerEnd = headerStart + headerLength;
  if (headerLength <= 0 || headerEnd > bytes.length) {
    return { ok: false, reason: 'Header length prefix is inconsistent with the file size' };
  }

  let header: unknown;
  try {
    const headerText = textDecoder.decode(bytes.slice(headerStart, headerEnd));
    header = JSON.parse(headerText);
  } catch (cause) {
    return { ok: false, reason: `Header is not valid JSON: ${String(cause)}` };
  }

  if (!isValidHeaderShape(header)) {
    return { ok: false, reason: 'Header is missing required fields' };
  }

  return {
    ok: true,
    header,
    sqliteBytes: bytes.slice(headerEnd),
  };
}

function isValidHeaderShape(value: unknown): value is SignedBackupHeaderJson {
  if (typeof value !== 'object' || value === null) return false;
  const h = value as Record<string, unknown>;
  return (
    typeof h.formatVersion === 'number' &&
    typeof h.cryptoFormatVersion === 'number' &&
    typeof h.appId === 'string' &&
    typeof h.sha256 === 'string' &&
    typeof h.publicKey === 'string' &&
    typeof h.signature === 'string' &&
    typeof h.createdAt === 'string'
  );
}

/**
 * Sniffs whether a file's bytes look like a `.kmesig` signed envelope
 * (magic prefix present) vs. a plain M8 `.sqlite` file. Used by the
 * restore flow to pick the right validation path without relying on the
 * filename extension alone.
 */
export function looksLikeSignedEnvelope(bytes: Uint8Array): boolean {
  if (bytes.length < SIGNED_ENVELOPE_MAGIC.length) return false;
  for (let i = 0; i < SIGNED_ENVELOPE_MAGIC.length; i++) {
    if (bytes[i] !== SIGNED_ENVELOPE_MAGIC[i]) return false;
  }
  return true;
}
