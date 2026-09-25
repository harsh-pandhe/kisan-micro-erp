import 'fake-indexeddb/auto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getDatabase, initializeDatabase } from '../../src/db/database';
import { loadPersistedBytes } from '../../src/db/persistence';
import { createAccount } from '../../src/features/accounting';
import { exportSignedDatabase } from '../../src/features/backup/export';
import { looksLikeSignedEnvelope, verifySignedBackup } from '../../src/features/crypto';
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

describe('exportSignedDatabase', () => {
  beforeEach(async () => {
    await resetDb();
    await clearKeyDb();
    await initializeDatabase();
  });
  afterEach(async () => {
    await resetDb();
    await clearKeyDb();
  });

  it('produces a signed envelope that verifies and matches the live database bytes', async () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const result = await exportSignedDatabase();

    expect(looksLikeSignedEnvelope(result.envelopeBytes)).toBe(true);
    const verification = verifySignedBackup(result.envelopeBytes);
    expect(verification.status).toBe('VALID');
  });

  it('does not mutate the live database or write to IndexedDB', async () => {
    createAccount({ code: '1000', name: 'Cash', type: 'asset' });
    const before = getDatabase().export();

    await exportSignedDatabase();

    const after = getDatabase().export();
    expect(after).toEqual(before);
    expect(await loadPersistedBytes()).toBeNull();
  });

  it('never embeds the private key anywhere in the envelope bytes', async () => {
    const { getOrCreateSigningKey } = await import('../../src/features/crypto/keys');
    const { privateKey } = await getOrCreateSigningKey();
    const result = await exportSignedDatabase();

    // A crude but effective check: the raw private key bytes must not
    // appear anywhere in the exported envelope.
    const hay = Buffer.from(result.envelopeBytes);
    const needle = Buffer.from(privateKey);
    expect(hay.includes(needle)).toBe(false);
  });

  it('uses the .kmesig filename convention, distinct from M8 .sqlite backups', async () => {
    const result = await exportSignedDatabase();
    expect(result.fileName).toMatch(/^kisan-micro-erp-signed-backup-.*\.kmesig$/);
  });
});
