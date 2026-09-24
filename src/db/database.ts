/**
 * SQLite-WASM (sql.js) lifecycle: init, schema application, IndexedDB
 * restore/persist. This is the only module that touches sql.js or
 * IndexedDB directly — everything else in the app goes through the typed
 * `AppDatabase` surface (see `types.ts`) so no raw SQL leaks into React
 * components. See docs/milestone-2.md for the full design writeup.
 */
import initSqlJs, { type Database as SqlJsDatabase, type SqlJsStatic } from 'sql.js';
import { loadPersistedBytes, savePersistedBytes } from './persistence';
import { SCHEMA_SQL } from './schema';
import { type AppDatabase, DatabaseError, type SqlParams, type SqlValue } from './types';

let sqlJsPromise: Promise<SqlJsStatic> | null = null;
let initPromise: Promise<AppDatabase> | null = null;
let appDb: AppDatabase | null = null;

/**
 * Under Vitest (Node, no real network/fetch server for relative URLs) we
 * point sql.js at the package's own copy of the wasm file on disk; sql.js
 * detects the Node environment and reads it via `fs` instead of `fetch`.
 * In the real browser build this branch never runs — Vite/BASE_URL always
 * resolves to the copy in `public/`.
 */
function locateSqlWasm(file: string): string {
  if (import.meta.env.MODE === 'test') {
    return `./node_modules/sql.js/dist/${file}`;
  }
  // sql.js needs to fetch its .wasm binary at runtime; it is copied to
  // public/ so Vite serves it as a static asset and vite-plugin-pwa
  // precaches it alongside the rest of the app shell (see
  // vite.config.ts globPatterns, which includes `wasm`).
  return `${import.meta.env.BASE_URL}${file}`;
}

function loadSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs({
      locateFile: locateSqlWasm,
    }).catch((cause) => {
      sqlJsPromise = null;
      throw new DatabaseError(
        'wasm-init-failed',
        'Failed to initialize sql.js WebAssembly module',
        cause,
      );
    });
  }
  return sqlJsPromise;
}

function wrap(raw: SqlJsDatabase): AppDatabase {
  return {
    raw,
    run(sql: string, params?: SqlParams) {
      raw.run(sql, params as never);
    },
    query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): T[] {
      const stmt = raw.prepare(sql);
      try {
        if (params) stmt.bind(params as never);
        const rows: T[] = [];
        while (stmt.step()) {
          rows.push(stmt.getAsObject() as T);
        }
        return rows;
      } finally {
        stmt.free();
      }
    },
    export() {
      return raw.export();
    },
  };
}

function applySchema(raw: SqlJsDatabase): void {
  try {
    raw.run('PRAGMA foreign_keys = ON;');
    raw.run(SCHEMA_SQL);
  } catch (cause) {
    throw new DatabaseError('schema-init-failed', 'Failed to apply database schema', cause);
  }
}

/**
 * Builds a `Database` from persisted bytes, verifying they are actually a
 * readable SQLite file before we trust them. Corrupted bytes are reported
 * as an error rather than silently discarded — we never overwrite a
 * persisted database we can't parse (see docs/milestone-2.md, "Failure
 * handling").
 */
function restoreFromBytes(sqlJs: SqlJsStatic, bytes: Uint8Array): SqlJsDatabase {
  let raw: SqlJsDatabase;
  try {
    raw = new sqlJs.Database(bytes);
  } catch (cause) {
    throw new DatabaseError('corrupted-bytes', 'Persisted database bytes could not be read', cause);
  }
  try {
    // Cheap integrity probe: a corrupted-but-openable file will usually
    // fail a real query against a known table.
    raw.exec("SELECT 1 FROM sqlite_master WHERE type='table' LIMIT 1;");
  } catch (cause) {
    raw.close();
    throw new DatabaseError('corrupted-bytes', 'Persisted database failed integrity check', cause);
  }
  // Idempotent: brings an older/partial schema up to date without touching
  // existing data.
  applySchema(raw);
  return raw;
}

async function doInitialize(): Promise<AppDatabase> {
  const sqlJs = await loadSqlJs();

  let persistedBytes: Uint8Array | null;
  try {
    persistedBytes = await loadPersistedBytes();
  } catch (cause) {
    throw new DatabaseError(
      'indexeddb-unavailable',
      'IndexedDB is unavailable in this browser; local data cannot be restored or saved',
      cause,
    );
  }

  let raw: SqlJsDatabase;
  if (persistedBytes && persistedBytes.length > 0) {
    raw = restoreFromBytes(sqlJs, persistedBytes);
  } else {
    raw = new sqlJs.Database();
    applySchema(raw);
  }

  const db = wrap(raw);
  appDb = db;
  return db;
}

/**
 * Initializes the database exactly once, even under concurrent callers:
 * every call while init is in flight shares the same promise instead of
 * racing to create a second sql.js instance.
 */
export function initializeDatabase(): Promise<AppDatabase> {
  if (!initPromise) {
    initPromise = doInitialize().catch((err) => {
      // Allow a fresh attempt after a failed init (e.g. transient IDB
      // failure) instead of permanently wedging the app.
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

/** Returns the already-initialized database, or throws if init hasn't run. */
export function getDatabase(): AppDatabase {
  if (!appDb) {
    throw new DatabaseError('unknown', 'getDatabase() called before initializeDatabase() resolved');
  }
  return appDb;
}

/** Serializes the current in-memory database and writes it to IndexedDB. */
export async function persistDatabase(): Promise<void> {
  const db = getDatabase();
  const bytes = db.export();
  try {
    await savePersistedBytes(bytes);
  } catch (cause) {
    throw new DatabaseError(
      'indexeddb-unavailable',
      'Failed to persist database to IndexedDB',
      cause,
    );
  }
}

/** Closes the sql.js connection and clears in-memory init state (mainly for tests). */
export function closeDatabase(): void {
  if (appDb) {
    appDb.raw.close();
  }
  appDb = null;
  initPromise = null;
}

/**
 * Atomically swaps the singleton database instance for a new sql.js
 * connection that the caller has already fully validated (see
 * `src/features/backup`). The old connection is closed so no stale
 * reference survives, and `initPromise` is set to an already-resolved
 * promise so every subsequent `getDatabase()`/`initializeDatabase()` call
 * anywhere in the app sees the replacement.
 *
 * This does NOT persist to IndexedDB — the caller decides when (or
 * whether) to call `persistDatabase()` afterwards, so a failed persist
 * cannot be confused with a failed swap.
 */
export function replaceDatabase(newRaw: SqlJsDatabase): AppDatabase {
  const previous = appDb;
  const next = wrap(newRaw);
  appDb = next;
  initPromise = Promise.resolve(next);
  if (previous && previous.raw !== newRaw) {
    previous.raw.close();
  }
  return next;
}

/** Loads sql.js once (shared with the singleton lifecycle) so callers can open a temporary, unattached Database. */
export async function loadSqlJsModule(): Promise<SqlJsStatic> {
  return loadSqlJs();
}
