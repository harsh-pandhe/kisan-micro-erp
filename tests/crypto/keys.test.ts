import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  generateNewSigningKey,
  getOrCreateSigningKey,
  getPublicKey,
  keyFingerprint,
  resetKeyStoreConnection,
} from '../../src/features/crypto/keys';
import { toHex } from '../../src/features/crypto/hash';

async function clearKeyDb(): Promise<void> {
  resetKeyStoreConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp-crypto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('getOrCreateSigningKey', () => {
  beforeEach(clearKeyDb);
  afterEach(clearKeyDb);

  it('generates a key on first use and does not regenerate on subsequent calls', async () => {
    const first = await getOrCreateSigningKey();
    const second = await getOrCreateSigningKey();
    expect(toHex(first.publicKey)).toBe(toHex(second.publicKey));
    expect(toHex(first.privateKey)).toBe(toHex(second.privateKey));
  });

  it('generates 32-byte private and public keys', async () => {
    const { privateKey, publicKey } = await getOrCreateSigningKey();
    expect(privateKey.length).toBe(32);
    expect(publicKey.length).toBe(32);
  });

  it('is retrievable via getPublicKey once created', async () => {
    const { publicKey } = await getOrCreateSigningKey();
    const fetched = await getPublicKey();
    expect(fetched && toHex(fetched)).toBe(toHex(publicKey));
  });

  it('returns null from getPublicKey before any key exists', async () => {
    expect(await getPublicKey()).toBeNull();
  });

  it('persists the key across a simulated fresh runtime (connection reset)', async () => {
    const original = await getOrCreateSigningKey();
    resetKeyStoreConnection();
    const reloaded = await getOrCreateSigningKey();
    expect(toHex(reloaded.publicKey)).toBe(toHex(original.publicKey));
    expect(toHex(reloaded.privateKey)).toBe(toHex(original.privateKey));
  });

  it('generateNewSigningKey replaces the active key with a different one', async () => {
    const original = await getOrCreateSigningKey();
    const replaced = await generateNewSigningKey();
    expect(toHex(replaced.publicKey)).not.toBe(toHex(original.publicKey));

    const fetched = await getOrCreateSigningKey();
    expect(toHex(fetched.publicKey)).toBe(toHex(replaced.publicKey));
  });
});

describe('keyFingerprint', () => {
  it('is the first 16 hex chars of SHA-256(publicKey), deterministic and 16 chars long', async () => {
    const { publicKey } = await getOrCreateSigningKey();
    const fp1 = keyFingerprint(publicKey);
    const fp2 = keyFingerprint(publicKey);
    expect(fp1).toBe(fp2);
    expect(fp1).toHaveLength(16);
    expect(fp1).toMatch(/^[0-9a-f]{16}$/);
  });
});
