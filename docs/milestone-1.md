# Milestone 1 — Application shell + PWA

Status: complete. Scope per `docs/development-roadmap.md`: a routable React
shell and an installable PWA, no real data yet.

## What was built

### Application shell

- `src/components/AppShell.tsx` — top-level layout: sticky `Header`, a
  `<main>` content region (with a skip link for keyboard users), and a
  `BottomNavigation` tab bar.
- `src/components/Header.tsx` — app name + live `OfflineStatus` indicator.
- `src/components/BottomNavigation.tsx` — five tabs (Dashboard,
  Transactions, Accounts, Reports, Settings). Fixed to the bottom of the
  viewport on phone widths; becomes a normal top nav bar at ≥768px.
- `src/components/ErrorBoundary.tsx` — a class component wrapping the whole
  router; catches render errors and shows a recoverable error state instead
  of a blank screen.

### Design system primitives (`src/components/`)

`Button`, `Card`, `Input`, `PageHeader`, `EmptyState`, `StatusBadge`,
`BottomNavigation`. All styled with plain CSS custom properties defined in
`src/index.css` (light and dark themes via `prefers-color-scheme`), no UI
library. Buttons and inputs use a 44px minimum touch target and visible
`:focus-visible` outlines.

### Pages (`src/pages/`)

`DashboardPage`, `TransactionsPage`, `AccountsPage`, `ReportsPage`,
`SettingsPage`, `NotFoundPage` — each a placeholder using `PageHeader` +
`EmptyState`/`Card`, explaining what will live there once later milestones
land. No accounting logic, parsing, or persistence in this milestone.

### Routing

`react-router-dom` v7 with `HashRouter` (`src/App.tsx`), routes:
`/`, `/transactions`, `/accounts`, `/reports`, `/settings`, plus a catch-all 404. `HashRouter` was chosen over `BrowserRouter` deliberately: the built
app is a static PWA that may be opened from a `file://`-style shell,
installed home-screen icon, or any static host with no server-side rewrite
rules configured. Hash-based routes (`/#/transactions`) always resolve to
`index.html` with zero server configuration, which matters for an app that
must also open correctly straight from the service worker cache while
offline.

### PWA

`vite-plugin-pwa` was already present in `package.json`/`vite.config.ts`
from Milestone 0 and is reused as-is:

- `manifest.webmanifest` — name, short_name, theme color (`#166534`),
  `display: standalone`, 192px/512px icons (`public/pwa-192x192.png`,
  `public/pwa-512x512.png` — real generated PNGs, not placeholders).
- Service worker (Workbox `generateSW`, `registerType: 'autoUpdate'`)
  precaches `**/*.{js,css,html,ico,png,svg,wasm}`, i.e. the entire app
  shell, so the shell loads with zero network after the first visit.

### Offline status

`src/hooks/useOnlineStatus.ts` wraps `navigator.onLine` plus the
`online`/`offline` window events. `src/components/OfflineStatus.tsx`
renders "Online" or "Offline — data stays on this device". This only
reflects network reachability — it does not imply any feature beyond the
app shell works offline yet (there is no data layer in this milestone).

## Verification performed

- `npm run lint` — passes, no warnings.
- `npm run format:check` — passes (Prettier).
- `npm run test` — 17 tests across 5 files pass (Vitest + Testing
  Library): app shell renders, all five routes render their page heading,
  bottom-nav navigation works, 404 fallback works, offline status responds
  to `navigator.onLine` and `online`/`offline` events, and the two
  disabled placeholder buttons ("Add Transaction", "Backup data") have
  accessible names.
- `npm run build` — succeeds (`tsc -b && vite build`); the PWA plugin
  reports the service worker and a manifest were generated, precaching 11
  entries (~283 KiB).
- `npm run preview` was started locally and `curl`'d: `/`, `/sw.js`, and
  `/manifest.webmanifest` all returned HTTP 200 with the expected title,
  then the preview server was stopped.

## Known limitations (honest, not claimed as tested)

- The sandbox this was built in is headless with no real browser, so
  **actual install-to-homescreen, offline-after-install, and
  background-sync behavior were not verified in a real browser/WebView**.
  Only the build output and the HTTP responses of the built files (via
  `vite preview` + `curl`) were checked. A manual check in Chrome/Android
  (DevTools → Application → Manifest/Service Workers, plus toggling
  "Offline" in DevTools) is recommended before relying on this for a
  device demo.
- No Lighthouse/PWA-audit run was performed here.

## Manual install/offline check (for a real device or desktop Chrome)

1. `npm run build && npm run preview`.
2. Open the preview URL in Chrome. DevTools → Application → Manifest
   should show the app as installable; Service Workers should show one
   activated worker.
3. Install via the browser's install icon / "Add to Home Screen".
4. Turn on airplane mode (or DevTools → Network → Offline) and relaunch
   the installed app — the shell (header, nav, all five pages) should
   still load.

## Explicitly NOT implemented in this milestone

Per the roadmap, none of the following exist yet — they are later
milestones and are out of scope here:

- SQLite-WASM / `sql.js` wiring, schema application (Milestone 2)
- IndexedDB persistence round-trip (Milestone 2)
- Double-entry accounting engine / voucher generation (Milestone 3)
- Transaction text/speech parser (Milestone 4)
- Ledger/item classification (Milestone 5)
- Functional transaction entry UI (Milestone 6)
- Real reports — Trial Balance, P&L, Balance Sheet (Milestone 7)
- Backup/restore of the database file (Milestone 8)
- Cryptographic signing (SHA-256/Ed25519) of exports (Milestone 9)

All Settings/Reports/Transactions/Accounts screens in this milestone are
static placeholders that describe this future functionality; none of it is
wired up.
