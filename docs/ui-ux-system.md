# Kisan UI/UX design system

Foundation layer added on top of the app that shipped in commit `2048b92`
(icon-based bottom nav, header logo, voice mic UI, reduced-motion-aware route
fade). This document describes the token system and component toolkit added
here. It is infrastructure only — **no existing page's layout was changed**.

## Design direction

Modern Indian fintech + agriculture + serious accounting software: trustworthy,
calm, modern, approachable, professional. Explicitly **not**: a generic admin
dashboard template, a flashy consumer SaaS look, glassmorphism, neon accents,
or heavy/constant motion. Surfaces are separated mostly by flat color and a
thin border, not by strong shadows; the deep green from the existing PWA
theme color (`#166534`) stays as the primary brand color.

## Color tokens

Defined in `src/index.css` under a Tailwind v4 `@theme` block, exposed as both
CSS custom properties (`--color-*`) and Tailwind utilities (`bg-primary`,
`text-muted-foreground`, etc). These are additive: the pre-existing
`--text`/`--bg`/`--accent`/... custom properties lower in the file are
untouched, since current components (`Button.css`, `Card.css`, ...) still read
them.

| Token                        | Light value | Dark value | Use                                               |
| ---------------------------- | ----------- | ---------- | ------------------------------------------------- |
| `--color-background`         | `#f6f5f2`   | `#101114`  | App background (warm off-white / near-black)      |
| `--color-foreground`         | `#16171d`   | `#f3f4f6`  | Primary text (warm charcoal)                      |
| `--color-card`               | `#ffffff`   | `#16171d`  | Card/surface background                           |
| `--color-card-foreground`    | `#16171d`   | `#f3f4f6`  | Text on cards                                     |
| `--color-muted`              | `#f0efe9`   | `#1e1f26`  | Soft warm-neutral surface (secondary backgrounds) |
| `--color-muted-foreground`   | `#6b6375`   | `#9ca3af`  | Secondary/muted text                              |
| `--color-border`             | `#e0dedb`   | `#2e303a`  | Hairline borders                                  |
| `--color-primary`            | `#166534`   | `#4ade80`  | Brand deep green                                  |
| `--color-primary-foreground` | `#ffffff`   | `#08120b`  | Text/icons on primary                             |
| `--color-secondary`          | `#f0efe9`   | `#1e1f26`  | Secondary surface/buttons                         |
| `--color-success`            | `#166534`   | `#4ade80`  | Positive amounts/status                           |
| `--color-warning`            | `#92400e`   | `#fbbf24`  | Amber warning status                              |
| `--color-danger`             | `#b91c1c`   | `#f87171`  | Red destructive/error status                      |
| `--color-info`               | `#1d4ed8`   | `#60a5fa`  | Blue informational status                         |
| `--color-ring`               | `#2563eb`   | `#60a5fa`  | Focus ring                                        |

## Dark mode decision

**Chosen: (A) — fully support light + dark**, mirroring every new token.
`src/index.css` already had a reasonably complete `prefers-color-scheme: dark`
block for the older token set (a full palette flip, not a half-finished
stub), so the new `@theme` tokens are mirrored the same way under
`@media (prefers-color-scheme: dark)` rather than disabling dark mode. There
is still no manual theme-switcher UI — this stays automatic, OS-driven, as
before.

## Typography

System font stack only (`system-ui, -apple-system, 'Segoe UI', Roboto,
Helvetica, Arial, sans-serif`) — no remote/Google fonts, required for offline
use. Utility classes in `src/index.css` (not yet used by existing pages):

| Class               | Size      | Weight | Use                                                     |
| ------------------- | --------- | ------ | ------------------------------------------------------- |
| `.text-display`     | 2.25rem   | 700    | Large hero numbers                                      |
| `.text-h1`          | 1.75rem   | 700    | Page titles                                             |
| `.text-h2`          | 1.375rem  | 600    | Section headings                                        |
| `.text-h3`          | 1.125rem  | 600    | Card titles                                             |
| `.text-body`        | 1rem      | 400    | Body copy                                               |
| `.text-body-small`  | 0.875rem  | 400    | Secondary copy                                          |
| `.text-caption`     | 0.75rem   | 400    | Hints, timestamps                                       |
| `.text-label`       | 0.8125rem | 600    | Form labels                                             |
| `.financial-number` | inherit   | 600    | `font-variant-numeric: tabular-nums`, for money amounts |

## Spacing

Tailwind's default 4px-increment spacing scale (1=4px, 2=8px, 3=12px, 4=16px,
5=20px, 6=24px, 8=32px, 10=40px, 12=48px, 16=64px) already matches the
requested scale — no override was added.

## Radius / elevation

`@theme`: `--radius-sm: 6px`, `--radius-md: 10px`, `--radius-lg: 14px`,
`--radius-xl: 20px`, `--radius-full: 9999px`.

Shadows are intentionally restrained (`--shadow-subtle`, `--shadow-card`,
`--shadow-overlay` in `src/index.css`): cards use only `--shadow-card` (a
1–3px, low-opacity shadow) and rely mainly on the `card`/`border` tokens for
separation; `--shadow-overlay` is reserved for genuinely lifted elements
(dialog/sheet/select popovers).

## Component hierarchy (`src/components/ui/`)

These are new, local, project-owned components in the shadcn/ui source
pattern (plain React + Radix primitives + `cva` variants + `cn()`), separate
from the existing hand-written `src/components/*` used by current pages.

- **button.tsx** — `UiButton` + `buttonVariants`. Variants: `primary`,
  `secondary`, `outline`, `ghost`, `destructive`, `link`. Sizes: `sm`, `md`,
  `lg`, `icon`. Supports `loading` (spinner + `aria-busy`, click-blocked) and
  standard `disabled`.
- **card.tsx** — `UiCard`, `CardHeader`, `CardTitle`, `CardDescription`,
  `CardContent`, `CardFooter`. `UiCard` takes a `tone` prop: `default`,
  `highlighted` (financial-summary emphasis), `warning`, `danger`.
- **input.tsx** / **textarea.tsx** — `UiInput`, `UiTextarea`. Support
  `aria-invalid` styling.
- **select.tsx** — Radix `Select` wrapped as `Select`, `SelectTrigger`,
  `SelectContent`, `SelectItem`, `SelectValue`, `SelectGroup`.
- **badge.tsx** — `Badge`. Variants: `default`, `success`, `warning`,
  `danger`, `info`. Never relies on color alone: every variant renders a
  small leading dot glyph alongside its text label — callers must still pass
  a text label (never an empty colored pill).
- **separator.tsx** — Radix `Separator`.
- **dialog.tsx** — Radix `Dialog` wrapped as `Dialog`, `DialogTrigger`,
  `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`,
  `DialogFooter`, `DialogClose`. Focus-trapped, Escape-to-close, animated
  enter/exit via CSS keyed off Radix's `data-state`.
- **alert-dialog.tsx** — Radix `AlertDialog`, for destructive confirmations
  (e.g. a future "restore from backup" flow) — cannot be dismissed by
  clicking outside, unlike `Dialog`.
- **sheet.tsx** — Bottom-sheet built on Radix `Dialog`: slides up from the
  bottom edge below the `sm` breakpoint, becomes a centered dialog at `sm`
  and above.
- **tabs.tsx** — Radix `Tabs` wrapped as `Tabs`, `TabsList`, `TabsTrigger`,
  `TabsContent` — for the future Reports page tab switching.
- **field.tsx** — `Field`: Label + control + Hint/Error wrapper with
  `htmlFor`/`id`/`aria-describedby`/`aria-invalid` wired automatically via
  `cloneElement`. Supports `disabled` and `error`.
- **toast.tsx** / **use-toast.tsx** — `Toaster` + `ToastProvider`/`useToast()`.
  Radix `Toast` under the hood, `aria-live="polite"` viewport, `success` /
  `info` / `warning` / `error` variants, auto-dismiss (4s) + manual dismiss,
  `motion`-driven enter/exit gated by `useReducedMotion()`. Mounted at the app
  root in `AppShell.tsx`; **not called from any page's business logic yet**.
- **page-container.tsx** — `PageContainer`: 16px mobile / 20–24px tablet /
  32px desktop horizontal padding, `max-w-4xl`. Not applied to any existing
  page this session (kept opt-in to avoid changing current page layout).

None of the above are wired into `AccountForm`, `TransactionInput`, or any
other existing page component this session, except `Toaster`/`ToastProvider`
at the shell level (which renders nothing until a toast is fired) — that was
judged safe since it adds no visible UI on its own.

## Accessibility

- A single focus-visible convention: `focus-visible:ring-2
focus-visible:ring-[var(--color-ring)]` (mapped to `--color-ring`,
  `#2563eb` light / `#60a5fa` dark — the same blue already used by the
  existing `--focus-ring` token) is used by every new interactive component.
  No existing component's focus behavior was changed.
- `Field` wires `htmlFor`/`id`/`aria-describedby`/`aria-invalid` for every
  form control.
- `Dialog`/`AlertDialog`/`Sheet` get Radix's built-in focus trap,
  Escape-to-close, and `role="dialog"`/labelling for free.
- `Toaster`'s viewport is `aria-live="polite"`.
- `Badge` never relies on color alone — see above.

## Motion conventions

Building on the `useReducedMotion()` gate already established in
`AppShell.tsx` (2048b92):

- **Page-enter**: existing route fade (`opacity`/`y` via `motion.div`,
  `duration: 0.18`) — unchanged.
- **Card-enter**: not animated by default this session (no existing page uses
  it); if added later, use the same `useReducedMotion()`-gated fade pattern.
- **Button-press**: `active:scale-[0.98]` (CSS, no JS) on `UiButton` — subtle,
  respects reduced motion implicitly since it's a discrete press state, not a
  continuous animation.
- **Success-state**: reserved for future use; the `Toast` `success` variant's
  entrance is the current example.
- **Layout transitions** (dialog/sheet/toast open-close): CSS transitions
  keyed off Radix's `data-state` attribute (`dialog.tsx`, `alert-dialog.tsx`,
  `sheet.tsx`) or `motion` + `AnimatePresence` (`toast.tsx`), all wrapped with
  `motion-reduce:transition-none` / `useReducedMotion()` so
  `prefers-reduced-motion: reduce` users get an instant state change instead.

No new animation was added to any existing page.

## Iconography

`lucide-react` and the favicon-derived header logo are unchanged from
2048b92 — not touched this session. Category guidance for future work,
following the mapping already used in `BottomNavigation.tsx`:

- **Navigation**: outline icons matched 1:1 to the bottom-nav routes
  (Dashboard, Transactions, Accounts, Reports, Settings).
- **Financial**: use `lucide-react`'s finance-adjacent icons (e.g. wallet,
  receipt, trending-up/down) — pick one meaning per icon and keep it
  consistent app-wide once page redesigns start using them.
- **Status**: paired with `Badge`'s dot convention — `CheckCircle2` (success),
  `AlertTriangle` (warning), `AlertCircle` (danger/error), `Info` (info), as
  already used in `toast.tsx`.
- **Action**: `Mic`/`Square` (voice input, unchanged), plus standard
  plus/edit/trash icons for future CRUD actions.

A dedicated branding milestone will replace the current favicon-derived mark
later; no logo work was done here.

## Responsive breakpoints / container

Tailwind's default breakpoints (`sm: 640px`, `md: 768px`, `lg: 1024px`,
`xl: 1280px`). `PageContainer` (`src/components/ui/page-container.tsx`)
standardizes horizontal padding: `16px` below `md`, `24px` at `md`, `32px` at
`lg`+, capped at `max-w-4xl` so desktop content stays readable rather than
stretching edge-to-edge.

## Offline-asset rule

Non-negotiable for this offline-first PWA: everything is bundled at build
time.

- Tailwind compiles at build time via `@tailwindcss/vite` — no CDN Tailwind,
  no runtime JIT in the browser.
- System font stack only; zero remote font requests.
- All Radix/lucide/motion/cva/clsx/tailwind-merge code ships in the bundled
  JS — no runtime CDN script tags.
- Verified: `dist/sw.js`'s precache list includes the new CSS bundle
  (`assets/index-*.css`) alongside the existing JS/wasm/icons/manifest, and a
  grep of the built `dist/index.html`/JS/CSS for `http://`/`https://`
  references found none beyond a couple of in-string documentation URLs
  embedded in React's own minified error messages (`react.dev/errors/...`,
  `reactrouter.com/...`) — not live requests.

## Migration strategy

Existing pages (`DashboardPage`, `TransactionsPage`, `AccountsPage`,
`ReportsPage`, `SettingsPage`) keep using their current components
(`src/components/Button.tsx`, `Card.tsx`, `Input.tsx`, `StatusBadge.tsx`, ...)
unchanged. They will be migrated to `src/components/ui/*` incrementally in
future, page-specific milestones, in this rough priority order per the
product owner's stated priorities:

1. **Transactions** — highest-value and most complex; flagged as the priority
   target (transaction input/review/history, voice input integration with the
   new `Toaster`).
2. **Dashboard** — financial summary cards (`UiCard` `highlighted` tone,
   `.financial-number`), status badges.
3. **Accounts** — `AccountForm` moves to `Field` + `UiInput`/`Select`;
   destructive account actions move to `AlertDialog`.
4. **Reports** — `Tabs` for report switching, `PageContainer`.
5. **Settings** — `Sheet`/`Dialog` for backup/restore confirmations
   (`AlertDialog` specifically for restore, since it's destructive).

Until each page's milestone lands, both component sets coexist; this is
expected and not a bug.

## Transactions page UX specification (M11-B)

The Transactions page (`src/pages/TransactionsPage.tsx`) is the first page
migrated to `src/components/ui/*`. Product framing: *"Tell Kisan Micro-ERP
what happened. It prepares the accounting entry. You review it. You decide
whether to record it."*

**Information hierarchy.** The composer textarea
(`TransactionInput.tsx`) is the visual focal point of the page: a large,
soft-bordered surface with a strong focus ring, sized for 3-5 lines. Example
chips are secondary (outline, small, pill-shaped) and only ever fill the
textarea — they never auto-submit. The primary CTA ("Review transaction")
is visually dominant; voice input sits beside it as an equal but
secondary affordance.

**State-model presentation.** The page still drives the same M6 state
machine (idle → parsed → classification → review → posting →
success/error); this milestone only restyles it:

- **Parsed (`ParseResultCard.tsx`)** — SUCCESS shows the amount as the
  largest element on the card (`.financial-number`), with type/party/item/
  payment-mode/date as secondary rows, omitting any field the parser didn't
  return rather than showing "—" placeholders. INVALID and AMBIGUOUS use a
  calm icon + heading + the *actual* `result.reasons` text — never invented
  copy — and AMBIGUOUS never lets the user proceed as if the transaction
  were valid.
- **Classification (`ClassificationCard.tsx`)** — MATCHED shows the account
  as a single confirmed row with the real match `reason` and a "Change
  account" action. UNKNOWN/AMBIGUOUS never suggest or create a fallback
  account; AMBIGUOUS candidates are rendered as selectable rows with an
  icon + text "selected" state (a border/ring and a check icon), never
  color alone, and never a pre-selected candidate. "Remember this for
  future transactions" is a plain accessible checkbox wired to the existing
  `learnMapping`/`relearnMapping` calls, unchanged in behavior — the UI only
  offers it where those calls apply.
- **Review (`TransactionReview.tsx`)** — the financial safety checkpoint.
  The amount is the largest element on the page at this state; an explicit
  "Nothing has been recorded yet." line sits above the primary "Record
  transaction" button so the distinction between *understood* and
  *recorded* is never ambiguous. The counter-account label reuses the
  existing `COUNTER_LABEL` mapping from M6 verbatim (restyled, not
  reimplemented).
- **Posting/success/error** — the record button shows a spinner + "Recording…"
  and is disabled for the entire in-flight call, preserving the exact M6
  guarantee of exactly one post per confirm (covered by
  `tests/transactions-page.test.tsx`). Success shows a `CircleCheck` +
  motion fade before the page returns to the entry state. Failure shows the
  real error message, "Nothing was posted." is implied by leaving the review
  card in place, and the user's typed text is preserved — never a fake
  success state.

**History (`TransactionHistory.tsx`).** A dividers-based list rather than a
card-per-row, grouped by Today/Yesterday/Earlier using only the existing
`createdAt` ordering (no re-query, no new sort). Direction (`+`/`-`) is only
shown for the voucher types the parser actually produces
(`sale`/`receipt` → `+`, `purchase`/`payment` → `−`); anything else is left
unsigned rather than guessed. Empty state uses the shared `EmptyState`
component (now with an optional `icon` slot) with an "Add transaction" CTA
that focuses the composer.

**Mobile behavior.** No component uses a fixed/sticky footer; the composer,
result, classification and review cards all flow in normal document order
so focusing the textarea never permanently hides the CTA behind an
on-screen keyboard. Layout uses simple flex/gap spacing rather than
`PageContainer` (this page's content is a single narrow column, so a
max-width wrapper was applied directly rather than through that
component).

**Motion.** Composer, parse-result, classification and review entrances use
the same `motion/react` + `useReducedMotion()` convention as
`AppShell.tsx`/`toast.tsx` (2048b92/552d055): an 8px upward fade over
150-250ms, skipped entirely when reduced motion is requested. The voice
button's "listening" pulse uses a slow, non-jarring `scale` loop, also
unaffected by the checkmark/icon meaning (it's a supplementary cue, not the
only listening indicator — the "Listening…" text label is always present
too).

**Accessibility notes specific to this page.** The composer textarea has a
visible, properly associated `<label>`; example chips are real `<button>`
elements; the mic button's accessible name switches between "Start voice
input" and "Stop voice input"; parse/classification result cards carry
`aria-live` (`polite` for success/matched, and `role="alert"` for
INVALID/AMBIGUOUS/errors) so screen-reader users hear outcomes without
extra navigation; after a parse, focus moves to the result heading; the
account `Select` and AMBIGUOUS candidate rows are keyboard-operable and
never rely on color alone (each carries an icon and/or text state); the
review card's error text uses `role="alert"` with `aria-live="assertive"`.
