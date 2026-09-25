import 'fake-indexeddb/auto';
import * as ed from '@noble/ed25519';
import { sha512 } from '@noble/hashes/sha2.js';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { fromHex, toHex } from '../../src/features/crypto/hash';
import { buildCanonicalPayload } from '../../src/features/crypto/payload';
import { signPayload, verifySignature } from '../../src/features/crypto';
import { getOrCreateSigningKey, resetKeyStoreConnection } from '../../src/features/crypto/keys';

if (!ed.hashes.sha512) {
  ed.hashes.sha512 = sha512;
}

async function clearKeyDb(): Promise<void> {
  resetKeyStoreConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp-crypto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

describe('Ed25519 known test vector (RFC 8032, TEST 1)', () => {
  // Independently-known vector — not computed via the code under test.
  const RFC8032_SECRET_KEY = '9d61b19deffd5a60ba844af492ec2cc44449c5697b326919703bac031cae7f60';
  const RFC8032_PUBLIC_KEY = 'd75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a';
  const RFC8032_SIGNATURE =
    'e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b';

  it('verifies the RFC 8032 TEST 1 signature over the empty message', () => {
    const secretKey = fromHex(RFC8032_SECRET_KEY);
    const publicKey = fromHex(RFC8032_PUBLIC_KEY);
    const signature = fromHex(RFC8032_SIGNATURE);
    const message = new Uint8Array(0);

    expect(verifySignature(signature, message, publicKey)).toBe(true);
    // Independently regenerate the public key from the secret key and
    // confirm it matches the published vector.
    expect(toHex(ed.getPublicKey(secretKey))).toBe(toHex(publicKey));
  });

  it('rejects the RFC 8032 vector signature against a different message', () => {
    const publicKey = fromHex(RFC8032_PUBLIC_KEY);
    const signature = fromHex(RFC8032_SIGNATURE);
    expect(verifySignature(signature, new TextEncoder().encode('not empty'), publicKey)).toBe(
      false,
    );
  });
});

describe('runtime keypair generate -> sign -> verify', () => {
  beforeEach(clearKeyDb);
  afterEach(clearKeyDb);

  it('signs a canonical payload and verifies with the matching public key', async () => {
    const { privateKey, publicKey } = await getOrCreateSigningKey();
    const digest = new Uint8Array(32).fill(7);
    const payload = buildCanonicalPayload(digest);

    const signature = signPayload(payload, privateKey);
    expect(signature.length).toBe(64);
    expect(verifySignature(signature, payload, publicKey)).toBe(true);
  });

  it('fails verification against the wrong message', async () => {
    const { privateKey, publicKey } = await getOrCreateSigningKey();
    const payload = buildCanonicalPayload(new Uint8Array(32).fill(1));
    const otherPayload = buildCanonicalPayload(new Uint8Array(32).fill(2));
    const signature = signPayload(payload, privateKey);
    expect(verifySignature(signature, otherPayload, publicKey)).toBe(false);
  });

  it('fails verification against a different (unrelated) public key', async () => {
    const { privateKey } = await getOrCreateSigningKey();
    const payload = buildCanonicalPayload(new Uint8Array(32).fill(3));
    const signature = signPayload(payload, privateKey);

    const otherSecret = ed.utils.randomSecretKey();
    const otherPublicKey = ed.getPublicKey(otherSecret);
    expect(verifySignature(signature, payload, otherPublicKey)).toBe(false);
  });
});
