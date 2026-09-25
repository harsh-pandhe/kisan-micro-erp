/**
 * SHA-256 hashing (Milestone 9). Uses `@noble/hashes` — pure JS, no
 * network, no Node-only APIs, browser-compatible.
 *
 * Canonical internal representation: `Uint8Array` for the raw digest
 * everywhere it is computed or compared; lowercase hex string only at the
 * edges (envelope storage / display). See docs/milestone-9.md, "SHA-256".
 */
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils.js';

/** Hashes raw bytes with SHA-256, returning the 32-byte digest. */
export function sha256Bytes(data: Uint8Array): Uint8Array {
  return sha256(data);
}

/** Hashes raw bytes with SHA-256, returning a lowercase hex string. */
export function sha256Hex(data: Uint8Array): string {
  return bytesToHex(sha256(data));
}

export function toHex(bytes: Uint8Array): string {
  return bytesToHex(bytes);
}

export function fromHex(hex: string): Uint8Array {
  return hexToBytes(hex);
}

/** Constant-time-ish comparison of two equal-length byte arrays (best-effort; not security-critical here since both values are already public). */
export function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
