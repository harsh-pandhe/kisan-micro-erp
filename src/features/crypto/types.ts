/**
 * Types for Milestone 9 (local SHA-256 hashing + Ed25519 signing for
 * exported backups). See docs/milestone-9.md for the full design writeup.
 *
 * This module is layered on top of Milestone 8's backup/restore flow. It
 * never mutates the SQLite database, never talks to the network, and never
 * lets a private key leave the browser.
 */

/** Bumped whenever the signed-backup envelope layout changes. */
export const SIGNED_BACKUP_FORMAT_VERSION = 1;

/** Bumped whenever the canonical signed-payload byte layout (what actually gets Ed25519-signed) changes. */
export const CRYPTO_FORMAT_VERSION = 1;

/** Same app identifier used by the signed payload and the envelope header. */
export const CRYPTO_APP_ID = 'kisan-micro-erp';

/** Magic bytes at the start of every `.kmesig` file: ASCII "KMES". */
export const SIGNED_ENVELOPE_MAGIC = new Uint8Array([0x4b, 0x4d, 0x45, 0x53]);

export type CryptoErrorKind =
  | 'key-store-unavailable'
  | 'key-generation-failed'
  | 'signing-failed'
  | 'malformed-envelope'
  | 'unsupported-format-version'
  | 'wrong-app-id'
  | 'invalid-hash'
  | 'invalid-signature'
  | 'invalid-public-key';

export class CryptoError extends Error {
  readonly kind: CryptoErrorKind;
  readonly cause?: unknown;

  constructor(kind: CryptoErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'CryptoError';
    this.kind = kind;
    this.cause = cause;
  }
}

/** A locally generated Ed25519 keypair. Raw 32-byte seed/point pairs, never encoded until needed for storage or display. */
export interface SigningKeyPair {
  privateKey: Uint8Array;
  publicKey: Uint8Array;
}

/** The exact envelope contents once parsed out of a `.kmesig` file. */
export interface SignedBackupEnvelope {
  formatVersion: number;
  cryptoFormatVersion: number;
  appId: string;
  sha256Hex: string;
  publicKeyHex: string;
  signatureHex: string;
  createdAt: string;
  /** The raw SQLite payload bytes (the actual backup content). */
  sqliteBytes: Uint8Array;
}

/** Discriminated result of verifying a signed backup — never throws past its boundary. */
export type SignedBackupVerification =
  | {
      status: 'VALID';
      hashValid: true;
      signatureValid: true;
      publicKeyHex: string;
      keyFingerprint: string;
      createdAt: string;
      sqliteBytes: Uint8Array;
    }
  | { status: 'INVALID_HASH'; message: string }
  | { status: 'INVALID_SIGNATURE'; message: string }
  | { status: 'INVALID_FORMAT'; message: string }
  | { status: 'UNSUPPORTED_VERSION'; message: string }
  | { status: 'MALFORMED_BACKUP'; message: string };
