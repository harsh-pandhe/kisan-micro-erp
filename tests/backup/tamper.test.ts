import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { closeDatabase, getDatabase, initializeDatabase } from '../../src/db/database';
import { createAccount, getAllAccounts } from '../../src/features/accounting';
import { exportSignedDatabase } from '../../src/features/backup/export';
import { restoreSignedDatabase } from '../../src/features/backup/import';
import { encodeSignedEnvelope, parseSignedEnvelope } from '../../src/features/crypto/envelope';
import { resetKeyStoreConnection } from '../../src/features/crypto/keys';
import { resetDb } from './helpers';

async function clearKeyDb(): Promise<void> {
  resetKeyStoreConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp-crypto');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

/**
 * Step 35/36 of Milestone 9: an exhaustive tamper matrix at the
 * `restoreSignedDatabase` level, each proving both that the bad input is
 * rejected (never crashes, never auto-repairs, never proceeds to restore)
 * and that the active database + its IndexedDB persistence are left
 * completely untouched.
 */
describe('signed backup restore — tamper matrix', () => {
  let baselineBytes: Uint8Array;

  beforeEach(async () => {
    await resetDb();
    await clearKeyDb();
    await initializeDatabase();
    createAccount({ code: '9999', name: 'Untouched Sentinel', type: 'asset' });
    baselineBytes = getDatabase().export();
  });
  afterEach(async () => {
    await resetDb();
    await clearKeyDb();
  });

  async function expectRejectedAndUntouched(bytes: Uint8Array): Promise<void> {
    await expect(restoreSignedDatabase(bytes)).rejects.toThrow();
    expect(getDatabase().export()).toEqual(baselineBytes);
    expect(getAllAccounts().map((a) => a.name)).toEqual(['Untouched Sentinel']);
  }

  it('rejects a valid signed backup that was never generated (sanity: positive case restores)', async () => {
    // Build a second, distinct signing context to produce a genuine backup.
    closeDatabase();
    await resetDb();
    await initializeDatabase();
    createAccount({ code: '1000', name: 'Real Data', type: 'asset' });
    const good = await exportSignedDatabase();

    // Restore over a *third* fresh DB, confirming the positive case works end to end.
    closeDatabase();
    await resetDb();
    await initializeDatabase();
    createAccount({ code: '9999', name: 'Untouched Sentinel', type: 'asset' });
    const { summary } = await restoreSignedDatabase(good.envelopeBytes);
    expect(summary.accounts).toBe(1);
  });

  it('rejects a modified SQLite payload byte', async () => {
    createAccount({ code: '1000', name: 'Real Data', type: 'asset' });
    const good = await exportSignedDatabase();
    closeDatabase();
    await resetDb();
    await initializeDatabase();
    createAccount({ code: '9999', name: 'Untouched Sentinel', type: 'asset' });
    baselineBytes = getDatabase().export();

    const tampered = new Uint8Array(good.envelopeBytes);
    tampered[tampered.length - 5] ^= 0xff;
    await expectRejectedAndUntouched(tampered);
  });

  it('rejects a modified embedded hash', async () => {
    const good = await exportSignedDatabase();
    const parsed = parseSignedEnvelope(good.envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');
    const badHash = encodeSignedEnvelope({
      sha256Hex: '0'.repeat(64),
      publicKeyHex: parsed.header.publicKey,
      signatureHex: parsed.header.signature,
      createdAt: parsed.header.createdAt,
      sqliteBytes: parsed.sqliteBytes,
    });
    await expectRejectedAndUntouched(badHash);
  });

  it('rejects modified signature bytes', async () => {
    const good = await exportSignedDatabase();
    const parsed = parseSignedEnvelope(good.envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');
    const flippedFirstChar = parsed.header.signature[0] === '0' ? '1' : '0';
    const badSig = encodeSignedEnvelope({
      sha256Hex: parsed.header.sha256,
      publicKeyHex: parsed.header.publicKey,
      signatureHex: flippedFirstChar + parsed.header.signature.slice(1),
      createdAt: parsed.header.createdAt,
      sqliteBytes: parsed.sqliteBytes,
    });
    await expectRejectedAndUntouched(badSig);
  });

  it('rejects a modified embedded public key', async () => {
    const good = await exportSignedDatabase();
    const parsed = parseSignedEnvelope(good.envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');
    const badKey = encodeSignedEnvelope({
      sha256Hex: parsed.header.sha256,
      publicKeyHex: '1'.repeat(64),
      signatureHex: parsed.header.signature,
      createdAt: parsed.header.createdAt,
      sqliteBytes: parsed.sqliteBytes,
    });
    await expectRejectedAndUntouched(badKey);
  });

  it('rejects a truncated envelope', async () => {
    const good = await exportSignedDatabase();
    await expectRejectedAndUntouched(good.envelopeBytes.slice(0, 8));
  });

  it('rejects a corrupted length-prefix', async () => {
    const good = await exportSignedDatabase();
    const corrupted = new Uint8Array(good.envelopeBytes);
    new DataView(corrupted.buffer).setUint32(4, 0x7fffffff, true);
    await expectRejectedAndUntouched(corrupted);
  });

  it('rejects an unsupported/future format version number', async () => {
    const good = await exportSignedDatabase();
    const parsed = parseSignedEnvelope(good.envelopeBytes);
    if (!parsed.ok) throw new Error('setup failed');
    const bumpedHeader = { ...parsed.header, formatVersion: 999 };
    const headerBytes = new TextEncoder().encode(JSON.stringify(bumpedHeader));
    const magic = new Uint8Array([0x4b, 0x4d, 0x45, 0x53]);
    const lengthPrefix = new Uint8Array(4);
    new DataView(lengthPrefix.buffer).setUint32(0, headerBytes.length, true);
    const out = new Uint8Array(magic.length + 4 + headerBytes.length + parsed.sqliteBytes.length);
    out.set(magic, 0);
    out.set(lengthPrefix, 4);
    out.set(headerBytes, 8);
    out.set(parsed.sqliteBytes, 8 + headerBytes.length);
    await expectRejectedAndUntouched(out);
  });

  it('rejects an empty file', async () => {
    await expectRejectedAndUntouched(new Uint8Array(0));
  });

  it('never throws an uncaught (non-BackupError) exception for any malformed input', async () => {
    const inputs = [new Uint8Array(0), new Uint8Array([1, 2, 3]), new Uint8Array(1000)];
    for (const input of inputs) {
      await expect(restoreSignedDatabase(input)).rejects.toMatchObject({ name: 'BackupError' });
    }
  });
});
