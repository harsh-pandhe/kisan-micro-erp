import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Regression test for the production "Database unavailable
 * (wasm-init-failed)" bug: sql.js's package.json `exports` map resolves to
 * a DIFFERENT glue file for the `browser` condition (which Vite's
 * production build uses) than for the Node/`default` condition (which
 * Vitest uses). Each glue file requests its own hard-coded `.wasm`
 * filename via `locateFile`. The two are functionally identical binaries,
 * but the browser one is a distinct FILE, `sql-wasm-browser.wasm`, and it
 * must actually be present under `public/` or the browser build 404s.
 *
 * This test reads the actual installed sql.js glue files (not our own
 * code) and cross-checks the wasm filename each one embeds against what
 * `public/` ships, so a future sql.js upgrade or a wrong file being
 * restored under `public/` fails the suite instead of only failing in a
 * real browser.
 */
describe('sql.js browser WASM asset', () => {
  function wasmFilenameEmbeddedIn(glueFilePath: string): string {
    const source = readFileSync(glueFilePath, 'utf-8');
    const match = source.match(/"(sql-wasm[a-z-]*\.wasm)"/);
    if (!match) {
      throw new Error(`Could not find an embedded .wasm filename in ${glueFilePath}`);
    }
    return match[1];
  }

  it('names the file the browser (production/Vite) build actually requests', () => {
    const browserGlue = require.resolve('sql.js/dist/sql-wasm-browser.js');
    const filename = wasmFilenameEmbeddedIn(browserGlue);
    expect(filename).toBe('sql-wasm-browser.wasm');
  });

  it('names the file the Node (Vitest test-mode) build actually requests', () => {
    const nodeGlue = require.resolve('sql.js/dist/sql-wasm.js');
    const filename = wasmFilenameEmbeddedIn(nodeGlue);
    expect(filename).toBe('sql-wasm.wasm');
  });

  it('ships the exact browser-requested WASM asset under public/', () => {
    const browserGlue = require.resolve('sql.js/dist/sql-wasm-browser.js');
    const filename = wasmFilenameEmbeddedIn(browserGlue);
    const publicAsset = resolve(__dirname, '../../public', filename);
    expect(existsSync(publicAsset)).toBe(true);
  });

  it('the shipped public/ WASM asset is byte-identical to the installed sql.js browser artifact', () => {
    const browserGlue = require.resolve('sql.js/dist/sql-wasm-browser.js');
    const filename = wasmFilenameEmbeddedIn(browserGlue);
    const installedWasm = readFileSync(
      resolve(__dirname, '../../node_modules/sql.js/dist', filename),
    );
    const publicWasm = readFileSync(resolve(__dirname, '../../public', filename));
    expect(publicWasm.equals(installedWasm)).toBe(true);
  });

  it('does not ship a stale/unused sql-wasm.wasm (the Node-only filename) under public/, to keep the PWA precache lean', () => {
    // public/sql-wasm.wasm is not requested by the browser bundle (the
    // Node test-mode branch in src/db/database.ts reads its copy straight
    // from node_modules, never from public/), so shipping it too would
    // just double the service-worker precache size for no benefit.
    const nodeOnlyAsset = resolve(__dirname, '../../public/sql-wasm.wasm');
    expect(existsSync(nodeOnlyAsset)).toBe(false);
  });
});
