/**
 * Canonical signed-payload construction (Milestone 9).
 *
 * This is the EXACT byte sequence that gets Ed25519-signed. It is small
 * and unambiguous by design: it commits to the backup format version, the
 * app identifier, and the raw SHA-256 digest of the SQLite payload bytes —
 * never the SQLite bytes themselves (which can be large). See
 * docs/milestone-9.md, "Canonical signed payload" for the field-by-field
 * layout this function implements.
 *
 * Layout (all integers little-endian, fixed width — no JSON, no
 * ambiguous encoding):
 *
 *   offset  size  field
 *   0       4     cryptoFormatVersion (uint32 LE)
 *   4       4     appId byte length (uint32 LE)
 *   8       N     appId (UTF-8 bytes, N = previous field)
 *   8+N     32    SHA-256 digest of the SQLite payload bytes
 *
 * Total length = 8 + N + 32.
 */
import { CRYPTO_APP_ID, CRYPTO_FORMAT_VERSION } from './types';

const textEncoder = new TextEncoder();

function writeUint32LE(value: number): Uint8Array {
  const buf = new Uint8Array(4);
  new DataView(buf.buffer).setUint32(0, value, true);
  return buf;
}

function readUint32LE(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0, true);
}

/**
 * Builds the canonical signed-payload bytes from a SHA-256 digest of the
 * SQLite bytes (NOT the SQLite bytes themselves) plus fixed metadata.
 */
export function buildCanonicalPayload(
  sha256Digest: Uint8Array,
  cryptoFormatVersion: number = CRYPTO_FORMAT_VERSION,
  appId: string = CRYPTO_APP_ID,
): Uint8Array {
  if (sha256Digest.length !== 32) {
    throw new RangeError(`sha256Digest must be exactly 32 bytes, got ${sha256Digest.length}`);
  }
  const appIdBytes = textEncoder.encode(appId);
  const out = new Uint8Array(8 + appIdBytes.length + 32);
  out.set(writeUint32LE(cryptoFormatVersion), 0);
  out.set(writeUint32LE(appIdBytes.length), 4);
  out.set(appIdBytes, 8);
  out.set(sha256Digest, 8 + appIdBytes.length);
  return out;
}

/** Parses a canonical payload back into its fields. Throws RangeError on malformed input. */
export function parseCanonicalPayload(bytes: Uint8Array): {
  cryptoFormatVersion: number;
  appId: string;
  sha256Digest: Uint8Array;
} {
  if (bytes.length < 8) {
    throw new RangeError('Canonical payload too short to contain a header');
  }
  const cryptoFormatVersion = readUint32LE(bytes, 0);
  const appIdLength = readUint32LE(bytes, 4);
  const expectedLength = 8 + appIdLength + 32;
  if (bytes.length !== expectedLength) {
    throw new RangeError(
      `Canonical payload length mismatch: expected ${expectedLength}, got ${bytes.length}`,
    );
  }
  const appId = new TextDecoder().decode(bytes.slice(8, 8 + appIdLength));
  const sha256Digest = bytes.slice(8 + appIdLength, 8 + appIdLength + 32);
  return { cryptoFormatVersion, appId, sha256Digest };
}
