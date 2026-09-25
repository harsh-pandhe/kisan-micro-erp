/**
 * Local Ed25519 key generation and storage (Milestone 9).
 *
 * The private key lives in its OWN dedicated IndexedDB database/object
 * store — never localStorage, never the SQLite financial database, never
 * an exported backup, never logged. See docs/milestone-9.md, "Key
 * storage".
 *
 * Wires `@noble/ed25519`'s synchronous API to `@noble/hashes`' sha512, as
 * required by @noble/ed25519 v3 (it no longer bundles a hash
 * implementation — see its README).
 */
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import { sha256Bytes, toHex } from './hash';
import { CryptoError, type SigningKeyPair } from './types';

// Wire the synchronous SHA-512 implementation @noble/ed25519 needs for its
// synchronous sign/verify/getPublicKey API. Safe to set unconditionally —
// idempotent, no network, no randomness.
if (!ed.hashes.sha512) {
  ed.hashes.sha512 = sha512;
}

const IDB_NAME = 'kisan-micro-erp-crypto';
const IDB_VERSION = 1;
const STORE_NAME = 'signing-keys';
/** Fixed key: there is exactly one active signing identity per install. */
const KEY_RECORD_ID = 'active';

interface CryptoKeySchema extends DBSchema {
  'signing-keys': {
    key: string;
    value: {
      privateKey: Uint8Array;
      publicKey: Uint8Array;
      createdAt: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<CryptoKeySchema>> | null = null;

function openKeyDb(): Promise<IDBPDatabase<CryptoKeySchema>> {
  if (!dbPromise) {
    dbPromise = openDB<CryptoKeySchema>(IDB_NAME, IDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    }).catch((cause) => {
      dbPromise = null;
      throw new CryptoError('key-store-unavailable', 'IndexedDB key store is unavailable', cause);
    });
  }
  return dbPromise;
}

/** Test/diagnostic helper: closes the underlying connection so it can be reopened, simulating a fresh runtime. */
export function resetKeyStoreConnection(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => undefined);
  }
  dbPromise = null;
}

async function loadStoredKeyPair(): Promise<SigningKeyPair | null> {
  const db = await openKeyDb();
  const record = await db.get(STORE_NAME, KEY_RECORD_ID);
  if (!record) return null;
  return { privateKey: record.privateKey, publicKey: record.publicKey };
}

async function saveKeyPair(pair: SigningKeyPair): Promise<void> {
  const db = await openKeyDb();
  await db.put(
    STORE_NAME,
    { privateKey: pair.privateKey, publicKey: pair.publicKey, createdAt: new Date().toISOString() },
    KEY_RECORD_ID,
  );
}

function generateKeyPair(): SigningKeyPair {
  try {
    const privateKey = ed.utils.randomSecretKey();
    const publicKey = ed.getPublicKey(privateKey);
    return { privateKey, publicKey };
  } catch (cause) {
    throw new CryptoError('key-generation-failed', 'Failed to generate an Ed25519 keypair', cause);
  }
}

/**
 * Returns the persisted signing keypair, generating and storing a new one
 * on first use. Never regenerates on every app start — a keypair is
 * created exactly once and reused across sessions via IndexedDB.
 */
export async function getOrCreateSigningKey(): Promise<SigningKeyPair> {
  const existing = await loadStoredKeyPair();
  if (existing) return existing;
  const generated = generateKeyPair();
  await saveKeyPair(generated);
  return generated;
}

/** Returns the current public key, or null if no key has been generated yet. */
export async function getPublicKey(): Promise<Uint8Array | null> {
  const existing = await loadStoredKeyPair();
  return existing ? existing.publicKey : null;
}

/**
 * Explicit, minimal key-reset action for recovery/testing. Does NOT
 * retroactively invalidate signatures made with the old key — those
 * remain valid and stay tied to the old public key forever. Callers must
 * obtain explicit user confirmation before calling this; it never runs
 * automatically.
 */
export async function generateNewSigningKey(): Promise<SigningKeyPair> {
  const generated = generateKeyPair();
  await saveKeyPair(generated);
  return generated;
}

/** First 16 hex chars of SHA-256(publicKey) — see docs/milestone-9.md, "Key fingerprint". */
export function keyFingerprint(publicKey: Uint8Array): string {
  return toHex(sha256Bytes(publicKey)).slice(0, 16);
}
