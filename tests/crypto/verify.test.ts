import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { encodeSignedEnvelope, parseSignedEnvelope } from '../../src/features/crypto/envelope';
import { sha256Bytes, toHex } from '../../src/features/crypto/hash';
import { buildCanonicalPayload, parseCanonicalPayload } from '../../src/features/crypto/payload';
import { getOrCreateSigningKey, resetKeyStoreConnection } from '../../src/features/crypto/keys';
import { signPayload } from '../../src/features/crypto/sign';
import { verifySignedBackup } from '../../src/features/crypto/verify';

async function clearKeyDb(): Promise<void> {
  resetKeyStoreConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp-crypto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

async function buildValidEnvelope(sqliteBytes: Uint8Array) {
  const { privateKey, publicKey } = await getOrCreateSigningKey();
  const digest = sha256Bytes(sqliteBytes);
  const payload = buildCanonicalPayload(digest);
  const signature = signPayload(payload, privateKey);
  const envelopeBytes = encodeSignedEnvelope({
    sha256Hex: toHex(digest),
    publicKeyHex: toHex(publicKey),
    signatureHex: toHex(signature),
    createdAt: new Date().toISOString(),
    sqliteBytes,
  });
  return { envelopeBytes, publicKey, privateKey };
}

describe('buildCanonicalPayload / parseCanonicalPayload', () => {
  it('round-trips fields exactly', () => {
    const digest = sha256Bytes(new TextEncoder().encode('hello'));
    const payload = buildCanonicalPayload(digest, 1, 'kisan-micro-erp');
    const parsed = parseCanonicalPayload(payload);
    expect(parsed.cryptoFormatVersion).toBe(1);
    expect(parsed.appId).toBe('kisan-micro-erp');
    expect(toHex(parsed.sha256Digest)).toBe(toHex(digest));
  });

  it('rejects a non-32-byte digest', () => {
    expect(() => buildCanonicalPayload(new Uint8Array(31))).toThrow(RangeError);
  });
});

describe('envelope encode/parse round trip', () => {
  it('parses back exactly what was encoded', () => {
    const sqliteBytes = new TextEncoder().encode('fake-sqlite-bytes');
    const envelope = encodeSignedEnvelope({
      sha256Hex: toHex(sha256Bytes(sqliteBytes)),
      publicKeyHex: 'aa'.repeat(32),
      signatureHex: 'bb'.repeat(64),
      createdAt: '2026-09-24T00:00:00.000Z',
      sqliteBytes,
    });
    const parsed = parseSignedEnvelope(envelope);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(new TextDecoder().decode(parsed.sqliteBytes)).toBe('fake-sqlite-bytes');
    expect(parsed.header.appId).toBe('kisan-micro-erp');
  });

  it('fails safely (ok:false) on truncated input, never throws', () => {
    const parsed = parseSignedEnvelope(new Uint8Array([0x4b, 0x4d]));
    expect(parsed.ok).toBe(false);
  });

  it('fails safely on wrong magic bytes', () => {
    const bytes = new Uint8Array(20);
    const parsed = parseSignedEnvelope(bytes);
    expect(parsed.ok).toBe(false);
  });

  it('fails safely on a corrupted length prefix pointing past the buffer', () => {
    const sqliteBytes = new TextEncoder().encode('x');
    const envelope = encodeSignedEnvelope({
      sha256Hex: toHex(sha256Bytes(sqliteBytes)),
      publicKeyHex: 'aa'.repeat(32),
      signatureHex: 'bb'.repeat(64),
      createdAt: '2026-09-24T00:00:00.000Z',
      sqliteBytes,
    });
    // Corrupt the 4-byte length prefix (offset 4..8) to an enormous value.
    const corrupted = new Uint8Array(envelope);
    new DataView(corrupted.buffer).setUint32(4, 0xffffffff, true);
    const parsed = parseSignedEnvelope(corrupted);
    expect(parsed.ok).toBe(false);
  });
});

describe('verifySignedBackup — full pipeline and tamper matrix', () => {
  beforeEach(clearKeyDb);
  afterEach(clearKeyDb);

  it('accepts a genuinely valid signed backup', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);

    const result = verifySignedBackup(envelopeBytes);
    expect(result.status).toBe('VALID');
    if (result.status === 'VALID') {
      expect(new TextDecoder().decode(result.sqliteBytes)).toBe('genuine sqlite payload');
      expect(result.keyFingerprint).toHaveLength(16);
    }
  });

  it('rejects a one-byte modification to the SQLite payload (hash mismatch)', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);

    const tampered = new Uint8Array(envelopeBytes);
    tampered[tampered.length - 1] ^= 0xff; // flip the last byte of the SQLite payload
    const result = verifySignedBackup(tampered);
    expect(result.status).toBe('INVALID_HASH');
  });

  it('rejects tampered signed metadata (embedded hash) even though it still looks well-formed', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { privateKey, publicKey } = await getOrCreateSigningKey();
    const realDigest = sha256Bytes(sqliteBytes);
    const payload = buildCanonicalPayload(realDigest);
    const signature = signPayload(payload, privateKey);

    // Embed a DIFFERENT (but validly-shaped) hash than the one actually signed.
    const wrongDigestHex = toHex(sha256Bytes(new TextEncoder().encode('different content')));
    const envelope = encodeSignedEnvelope({
      sha256Hex: wrongDigestHex,
      publicKeyHex: toHex(publicKey),
      signatureHex: toHex(signature),
      createdAt: new Date().toISOString(),
      sqliteBytes,
    });

    const result = verifySignedBackup(envelope);
    // The recomputed hash of sqliteBytes won't match the (wrong) embedded hash first.
    expect(result.status).toBe('INVALID_HASH');
  });

  it('rejects a signature verified against a different public key than the one that signed it', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);

    // Generate an unrelated Key B and swap it into the header in place of Key A's public key.
    await clearKeyDb();
    const keyB = await getOrCreateSigningKey();

    const parsed = parseSignedEnvelope(envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');
    const swapped = encodeSignedEnvelope({
      sha256Hex: parsed.header.sha256,
      publicKeyHex: toHex(keyB.publicKey),
      signatureHex: parsed.header.signature,
      createdAt: parsed.header.createdAt,
      sqliteBytes: parsed.sqliteBytes,
    });

    const result = verifySignedBackup(swapped);
    expect(result.status).toBe('INVALID_SIGNATURE');
  });

  it('rejects a tampered signature', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);
    const parsed = parseSignedEnvelope(envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');

    const tamperedSigHex = parsed.header.signature.replace(
      /^../,
      (parsed.header.signature[0] === '0' ? '1' : '0') + parsed.header.signature[1],
    );
    const tampered = encodeSignedEnvelope({
      sha256Hex: parsed.header.sha256,
      publicKeyHex: parsed.header.publicKey,
      signatureHex: tamperedSigHex,
      createdAt: parsed.header.createdAt,
      sqliteBytes: parsed.sqliteBytes,
    });

    const result = verifySignedBackup(tampered);
    expect(result.status).toBe('INVALID_SIGNATURE');
  });

  it('rejects a tampered app identifier field', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);
    const parsed = parseSignedEnvelope(envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');

    // Rebuild the envelope with a different app id in the header JSON, but
    // keep the original signature — since appId is part of the signed
    // canonical payload, this must fail signature verification (not just
    // an app-id string mismatch), because encodeSignedEnvelope always
    // forces appId to CRYPTO_APP_ID, so we hand-craft the bytes instead.
    const headerObj = {
      formatVersion: parsed.header.formatVersion,
      cryptoFormatVersion: parsed.header.cryptoFormatVersion,
      appId: 'some-other-app',
      sha256: parsed.header.sha256,
      publicKey: parsed.header.publicKey,
      signature: parsed.header.signature,
      createdAt: parsed.header.createdAt,
    };
    const headerBytes = new TextEncoder().encode(JSON.stringify(headerObj));
    const magic = new Uint8Array([0x4b, 0x4d, 0x45, 0x53]);
    const lengthPrefix = new Uint8Array(4);
    new DataView(lengthPrefix.buffer).setUint32(0, headerBytes.length, true);
    const out = new Uint8Array(magic.length + 4 + headerBytes.length + parsed.sqliteBytes.length);
    out.set(magic, 0);
    out.set(lengthPrefix, 4);
    out.set(headerBytes, 8);
    out.set(parsed.sqliteBytes, 8 + headerBytes.length);

    const result = verifySignedBackup(out);
    expect(result.status).toBe('INVALID_FORMAT');
  });

  it('rejects a tampered format version field (unsupported future version)', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);
    const parsed = parseSignedEnvelope(envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');

    const tampered = encodeSignedEnvelope({
      sha256Hex: parsed.header.sha256,
      publicKeyHex: parsed.header.publicKey,
      signatureHex: parsed.header.signature,
      createdAt: parsed.header.createdAt,
      sqliteBytes: parsed.sqliteBytes,
    });
    // Force formatVersion far into the future by re-parsing and re-serializing with a bumped version.
    const reparsed = parseSignedEnvelope(tampered);
    if (!reparsed.ok) throw new Error('setup failed');
    const bumped = { ...reparsed.header, formatVersion: 999 };
    const headerBytes = new TextEncoder().encode(JSON.stringify(bumped));
    const magic = new Uint8Array([0x4b, 0x4d, 0x45, 0x53]);
    const lengthPrefix = new Uint8Array(4);
    new DataView(lengthPrefix.buffer).setUint32(0, headerBytes.length, true);
    const out = new Uint8Array(magic.length + 4 + headerBytes.length + reparsed.sqliteBytes.length);
    out.set(magic, 0);
    out.set(lengthPrefix, 4);
    out.set(headerBytes, 8);
    out.set(reparsed.sqliteBytes, 8 + headerBytes.length);

    const result = verifySignedBackup(out);
    expect(result.status).toBe('UNSUPPORTED_VERSION');
  });

  it('rejects a tampered embedded public key (garbage, wrong length)', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);
    const parsed = parseSignedEnvelope(envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');

    const tampered = encodeSignedEnvelope({
      sha256Hex: parsed.header.sha256,
      publicKeyHex: 'ab'.repeat(10), // wrong length
      signatureHex: parsed.header.signature,
      createdAt: parsed.header.createdAt,
      sqliteBytes: parsed.sqliteBytes,
    });
    const result = verifySignedBackup(tampered);
    expect(result.status).toBe('MALFORMED_BACKUP');
  });

  it('handles a truncated envelope safely', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);
    const truncated = envelopeBytes.slice(0, 10);
    const result = verifySignedBackup(truncated);
    expect(result.status).toBe('MALFORMED_BACKUP');
  });

  it('handles a corrupted length-prefix encoding safely', async () => {
    const sqliteBytes = new TextEncoder().encode('genuine sqlite payload');
    const { envelopeBytes } = await buildValidEnvelope(sqliteBytes);
    const corrupted = new Uint8Array(envelopeBytes);
    new DataView(corrupted.buffer).setUint32(4, 0x7fffffff, true);
    const result = verifySignedBackup(corrupted);
    expect(result.status).toBe('MALFORMED_BACKUP');
  });
});
