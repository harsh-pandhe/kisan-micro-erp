# db

SQLite-WASM (sql.js) schema and query layer. Does not talk to the UI directly.

- `schema.ts` — the SQL DDL applied to every fresh or restored database.
- `types.ts` — the typed `AppDatabase` surface the rest of the app uses
  instead of raw sql.js.
- `persistence.ts` — IndexedDB (via `idb`) byte-blob storage for the
  serialized database.
- `database.ts` — lifecycle: `initializeDatabase()`, `getDatabase()`,
  `persistDatabase()`, `closeDatabase()`. See `docs/milestone-2.md`.
