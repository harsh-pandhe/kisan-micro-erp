import { closeDatabase } from '../../src/db/database';
import { resetPersistenceConnection } from '../../src/db/persistence';

export async function clearPersistedDb(): Promise<void> {
  resetPersistenceConnection();
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase('kisan-micro-erp');
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve();
  });
}

export async function resetDb(): Promise<void> {
  closeDatabase();
  await clearPersistedDb();
}
