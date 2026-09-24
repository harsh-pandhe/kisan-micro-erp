/**
 * IndexedDB persistence for the serialized SQLite database.
 *
 * The whole sql.js database is stored as a single binary blob — never
 * individual tables/rows — so the SQLite file is always the source of
 * truth and IndexedDB is a dumb byte store for it (see
 * docs/architecture.md, "How persistence works").
 */
import { type DBSchema, type IDBPDatabase, openDB } from 'idb';

const IDB_NAME = 'kisan-micro-erp';
const IDB_VERSION = 1;
const STORE_NAME = 'sqlite';
/** Fixed key: there is exactly one database blob per install. */
const BLOB_KEY = 'main';

interface PersistenceSchema extends DBSchema {
  sqlite: {
    key: string;
    value: {
      bytes: Uint8Array;
      updatedAt: string;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<PersistenceSchema>> | null = null;

function openPersistenceDb(): Promise<IDBPDatabase<PersistenceSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<PersistenceSchema>(IDB_NAME, IDB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      },
    });
  }
  return dbPromise;
}

/** Returns the persisted database bytes, or null if this is a first run. */
export async function loadPersistedBytes(): Promise<Uint8Array | null> {
  const db = await openPersistenceDb();
  const record = await db.get(STORE_NAME, BLOB_KEY);
  return record ? record.bytes : null;
}

/** Overwrites the persisted database bytes with the current in-memory state. */
export async function savePersistedBytes(bytes: Uint8Array): Promise<void> {
  const db = await openPersistenceDb();
  await db.put(STORE_NAME, { bytes, updatedAt: new Date().toISOString() }, BLOB_KEY);
}

/** Test/diagnostic helper: closes the underlying connection so it can be reopened. */
export function resetPersistenceConnection(): void {
  if (dbPromise) {
    dbPromise.then((db) => db.close()).catch(() => undefined);
  }
  dbPromise = null;
}
