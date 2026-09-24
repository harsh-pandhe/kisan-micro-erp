/** Small typed surface the rest of the app uses instead of raw sql.js. */
import type { Database as SqlJsDatabase } from 'sql.js';

export type SqlValue = string | number | Uint8Array | null;
export type SqlParams = SqlValue[] | Record<string, SqlValue>;

export interface AppDatabase {
  /** The underlying sql.js database. Only the db layer should need this. */
  readonly raw: SqlJsDatabase;
  /** Runs a statement with no result rows (INSERT/UPDATE/DELETE/DDL). */
  run(sql: string, params?: SqlParams): void;
  /** Runs a SELECT and returns all rows as plain objects. */
  query<T = Record<string, SqlValue>>(sql: string, params?: SqlParams): T[];
  /** Exports the current database state as bytes, for persistence. */
  export(): Uint8Array;
}

export type DbStatus = 'idle' | 'initializing' | 'ready' | 'error';

export type DbErrorKind =
  | 'wasm-init-failed'
  | 'indexeddb-unavailable'
  | 'corrupted-bytes'
  | 'schema-init-failed'
  | 'unknown';

export class DatabaseError extends Error {
  readonly kind: DbErrorKind;
  readonly cause?: unknown;

  constructor(kind: DbErrorKind, message: string, cause?: unknown) {
    super(message);
    this.name = 'DatabaseError';
    this.kind = kind;
    this.cause = cause;
  }
}
