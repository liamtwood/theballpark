# Ballpark — Progress Log

A running log of what's been built, what's next, and decisions made.
Newest at the top. One entry per shipped prompt.

For workflow + ship-report process, see `CLAUDE.md`. For prompt status
table (Draft / Ready / Shipped / Done), see `prompts/backlog.md`.

---

## In flight

- **pV2-04 — Agent home + page-settings drawer** — Ready. Ports v1's agent
  home (p0014 + p0017 + p0018 + p0019 + p0023 + p0032) to v2 patterns. New
  components: home-agent + 6 section cards + launcher grid + page-settings
  drawer + stub coming-soon routes. New endpoints: `/api/dashboard/*`. Auto-
  save to `org_type_config`. 30 acceptance criteria including v2 hygiene
  auto-fails. Single prompt, multiple commits. Chip target `[Dev v2] v2.09a`.

## Backlog (drafts, not yet started)

- pV2-05 — Supplier home (variant of pV2-04 — reuses section primitives, swaps section list + launcher tile set)
- pV2-06 — Marketplace (catalogue + cart)
- pV2-07 — Inbox (3-column shell + tree + conversation + status pills)
- pV2-08 — Profile / storefront
- pV2-09 — Settings: Org / Subscription / Profile editor
- pV2-10 — Page-settings drawer extensions (per-user overrides, more fields)
- pV2-11 — Retire `client-angular/`, cutover to `client-v2`

---

## Shipped

### 2026-08-24/25 — pV2-BUILDUP-01: item composition foundations (v2.62–v2.64, dev only, pre-audit)

The start of the item-composition / cost-buildup arc. **Dev only — not yet
promoted or audited.** Most of the session was DESIGN; the code is the first
slice.

**Design (the bulk):**
- Converged the composition data model by mocking the real Made Workshop
  "Netflix Fury" quote as spreadsheets (`scratchpad/ballpark-item-model.xlsx`
  / `build_model.py`). Settled: **one uniform recursive node**
  (`project_items.parent_id`), the tree is **pure cost**, **single
  project-level margin** (the existing `EstimateBreakdown` cascade), `added_by`
  = the authority/visibility line. Cost vs charge = roll-up is cost, charge
  sits above, margin is the gap. **Private-cost boundary** (leaf costs never
  reach a client surface) is an RP-11-shaped rule.
- Verified `items.parent_item_id` / `derived_from_id` are dormant (0 of 346
  rows) → safe to adopt. Confirmed `project_items` has `category_id` but NO
  subcategory (parked edge).
- Model + 3 remaining jobs (options, time & materials, variants) captured in
  memory (`project_recursive_lineitem_model`).

**Code:**
- **v2.62** — additive schema: `items.kind`, `project_items.kind`,
  `project_items.parent_id` (+ index). Dormant *at v2.62*; regression clean. The
  key-constraint relax (same-item-twice) deferred (fringe).
- **⚠ Correction (2026-09-03, verified against code):** `project_items.parent_id`
  and `project_items.kind` are **now LIVE**, not dormant. The inbox Customize /
  estimate buildup (pV2-BUILDUP-02/03) writes them (`saveComponents`,
  `projects.service.js:855–865`), reads them (`listComponents` / `COMPONENT_SELECT`,
  `:792`), and the estimate/quote rolls children up (top-level gate
  `pi.parent_id IS NULL`, `:494/:501/:568/:615` — "the private cost buildup"); prod
  rows are populated. BUILDUP-01 *extended* a mechanism the inbox already uses (the
  RP-11 private-cost boundary). Still dormant: `items.parent_item_id` /
  `derived_from_id` (catalogue lineage, 0/346). The 2026-08-25 audits said "confirmed
  inert" because they read schema and never traced the `saveComponents` write path.
- **v2.63** — UI1: supplier-item type-ahead lookup in the add-line dialog
  (pick = reference the real item, type = new custom line, tagged via
  `project_item_suppliers`). Fixed "Add button vanishes on return" (estimate
  tracks *collapsed* categories → defaults expanded).
- **v2.64** — the new/explore dialog split. `new` ("Add Your Own Line Item")
  = agent-owned custom lines (Form/Grid, no supplier). `explore` ("Explore
  More" on a line's preview card) = "More From <supplier>": inverted shuttle
  (browse left, ✓Added, picks right grouped category→subcategory), category as
  an icon+title header, pre-loaded with the supplier+category's existing lines
  and **reconciled** on Save (add / remove / qty via addQuoteItem /
  removeQuoteItem / setQuoteItemQuantity). The `explore` dialog is the primitive
  the supplier's "Estimate Item" (deconstruct) will reuse.

Zero-schema beyond the dormant columns (rides `project_item_suppliers` +
existing endpoints).

Files: `custom-line-dialog.component.ts` (rewritten), `project-estimate.component.ts`,
`estimate-preview-rail.component.ts`, `project.service.ts`, `projects-v2.js`,
`projects.service.js`, `migrate-schemas.js`.

Concerns for audit: the `explore` reconcile diff in `addCustom`; the
private-cost boundary (RP-11 shape — enforce everywhere a line renders once
components land); confirm `kind`/`parent_id` are truly inert until wired (superseded — now LIVE, see the v2.62 correction above); the
parked subcategory-on-existing edge (category-only grouping for pre-loaded lines).

**Design-review corrections (2026-08-25, CC review of `components-one-pager.html`):**
`added_by` is **not a column** — the authority/visibility stamp is `created_by`
(and `client_visible` is a to-build field, not yet in schema). `items.parent_item_id`
is already **lineage** ("variant of / born from") and a writable pass-through today,
so the catalogue-composition tree needs its **own** FK (e.g. `composed_under_id`) or
the `item_components` join — overloading `parent_item_id` is a Rule 7 / RP-11 drift
risk. Three open decisions before this guides a build: (1) composition-parent storage
(new FK vs join); (2) whether a child's catalogue provenance sits in an unscoped
`item_id` — which *forces* the `uq_project_items_canonical` relax — or elsewhere;
(3) the %-fee split (%-of-cost = tree node; client fee = project cascade layer beside
margin/VAT — **proposed, pending lock**). Also promoted to preview + architect-audited
(no blockers) at v2.65 since this entry's header was written.

---

### 2026-06-11 — pV2-AUDIT-03: API audit checklist + Helmet + Zod

v2.08a. Hardens the v2 API surface.

What changed:
- 8-area per-endpoint API audit checklist added to WORKING_STANDARDS § Engineering hygiene
- cc-onboarding requires CC to walk the checklist per endpoint touched + include in ship report
- `helmet` installed and mounted in `server/src/index.js` — `X-Powered-By` gone, HSTS / X-Frame-Options / X-Content-Type-Options live
- `zod` installed; `/api/onboarding/create-org` refactored to use `CreateOrgSchema` in `server/src/schemas/` as the example pattern (others migrate opportunistically)
- 6 unit tests added for the create-org schema; server suite now 19 specs
- `npm audit` baseline captured: 10 server findings (8 moderate, 2 high, 0 critical, all transitive)

Two small inconsistencies surfaced and resolved:
- Zod was not transitively in node_modules — installed fresh as v4
- Zod v4 deprecates `.flatten()` — used `z.flattenError()` instead

Verified live:
- Helmet headers via curl on `/api/me`
- 400 `{ error, details }` shape on invalid create-org body
- 409 intact for "already has an org"
- npm audit clean run captured

Background: `65d67fc` (orphan find — not from this prompt) recreated `users_email_key` and `users_google_sub_uidx` as partial unique indexes scoped to `deleted_at IS NULL`, closing the soft-delete tombstone bug surfaced during pV2-02b QC.

Concerns flagged: create-org returns 200 not 201 (no resource URL to point Location at — defensible); create-org has a verb-ish path (defensible — no resource at `/orgs` POST yet). Post-commit log hook silently failed once more (`e24bcbf` caught + manually logged) — backlog item now twice-justified.

---

### 2026-06-11 — pV2-02b: Public landing page + onboarding flow

v2.07a. Replaces pV2-02's auto-create-workspace behavior with an explicit onboarding step.

What changed:

**Section A — public landing + route restructure:**
- New `<app-landing>` at `/` — Ballpark wordmark in header (Sign In link) + "Sign Up — it's free" CTA in body, both call `/auth/google`
- Restructured routes: `/home` is the auth shell (was `/`), shell wordmark routes to `/home`, `/login` kept for dev-picker access (redirects to `/` in prod)
- `<app-wordmark>` + `<app-public-header>` extracted — no duplicated chrome

**Section B — onboarding:**
- Single screen: radio tiles (Event Agency / Supplier), pre-filled org name (`{firstName}'s Agency/Supplier`)
- Submit creates org + admin membership atomically via `withTransaction`, signs fresh JWT carrying new org_id (deprecated authority claims now dropped per Liam's approval)
- Server: `upsertUserFromGoogle` step 3 now creates `users` row only (no auto-org); `buildSession` returns partial session with null org fields when orgless; new `POST /api/onboarding/create-org`
- Client: `SessionUser.activeOrgId` widens to `string | null`; new `needsOnboardingGuard` + `requiresOrgGuard`; `/onboarding` pure-bleed route
- `authGuard` deleted (superseded by `requiresOrgGuard`)
- 13 new specs

Two real bugs caught via the new precedence rule:
- The spec's create-org sketch called `buildSession` INSIDE `withTransaction`, but buildSession reads via the shared pool — under READ COMMITTED it can't see the uncommitted rows. Moved to after commit.
- `users.role` has a legacy `DEFAULT 'member'` — omitting the column (as the sketch did) silently re-grants the deprecated authority. INSERT now passes NULL explicitly.

Verified live:
- 13/13 acceptance + 0a–0f (landing page) verified
- Rollback drill: ghost user → valid JWT → org INSERT succeeds → membership FK fails → 500 → zero orphan orgs
- Full orgless journey: bounce → pre-fill "Onboarding's Agency" → suffix swap with dirty-field protection → submit → admin at new org on /home
- Invitee simulation: stub linked, status flipped invited→active, lands /home without seeing onboarding
- v1 on 4200 unchanged

Soft-delete tombstone bug found during QC setup (legacy `users_email_key` not partial) — closed in `65d67fc` separately (see AUDIT-03 entry above).

---

### 2026-06-11 — pV2-AUDIT-02: 10 engineering hygiene fixes

v2.06a. Codifies and fixes the violations from AUDIT-01.

What changed (10 commits in priority order):

| # | SHA | Fix |
|---|---|---|
| 0 | `192069e` | `withTransaction(fn)` helper (GUC-preserving — sets `app.current_user_id` from ALS inside the txn so audit attribution survives) |
| 1 | `9a79560` | `requireActiveMembership` middleware + gated v2 router (default-on, opt-in for any new v2 endpoint) |
| 2 | `26dad8b` | Transactional signup upsert (uses Fix 0; no hand-rolled BEGIN/COMMIT) |
| 3 | `4af5ce4` | JWT authority claims marked DEPRECATED + comment citing rule |
| 4 | `ae149e7` | `express-rate-limit` mounted on all auth endpoints + `app.set('trust proxy', 1)` |
| 4b | `34d01f8` | `sessionCookieOptions()` shared between set + clear paths (closes silent-logout bug when JWT_COOKIE_DOMAIN configured) |
| 5 | `bfeacc8` | Tailwind palette REPLACED with token-only set + semantic state tokens (`--color-success/warn/danger/info/action` + soft variants); compile-time enforcement |
| 6 | `9608a1a` | Test batch: 41 specs (28 client + 13 server) including client↔server permissions matrix parity check |
| 7 | `851ed7e` | Catch blocks justify themselves — 401 silent in `loadSession()`, 5xx logged as `[auth] /auth/me failed unexpectedly` |
| 8 | `493f2c3` | Hello page imperative `.subscribe()` → `httpResource()`; zero raw `.subscribe()` in v2 |

Drills (not just compile-checks):
- Fix 5 drill: confirmed Tailwind silently ignores raw classes, so the `check-raw-colors.js` grep guard in `npm run lint` is the actual failing check
- Fix 6 drill: deliberately desynced the server matrix → parity spec failed with "role agency_member diverges"
- Fix 7 warn path: transient dev-server restarts logged `[auth] /auth/me failed unexpectedly`; steady-state silent

Verified: 10/10 acceptance + drills; `ng build` clean; client tests 28/28; server tests 13/13; lint + grep guard green; visual parity on login/hello/team confirmed by computed styles.

Concerns flagged at ship: per-request membership query cost (acceptable, no action); JWT claim-drop left for pV2-02b; no CI exists so 41 specs only run by hand; pre-existing 527 kB bundle-budget warning; post-commit log hook silently failed once.

---

### 2026-06-11 — pV2-AUDIT-01: Engineering hygiene rules + ship-report process

Docs-only. Hardens the WORKING_STANDARDS and ship-report process after the post-pV2-03 audit found multiple silent violations.

What changed:
- New "Engineering hygiene — non-negotiable" section in WORKING_STANDARDS with 9 rules (transactions, tokens, rate limiting, JWT identity, catch blocks, shared middleware, duplicate enforcement, pure-function tests, hygiene precedence)
- Each rule cites the past violation that motivated it (educational, not just prescriptive)
- New mandatory "Concerns not in spec" section in every ship report
- New "audit before shipped" process rule — chat reviews actual code before backlog row flips to Done
- New `Shipped` intermediate backlog status (between Ready and Done) so audit-gate state is visible
- Retroactive "Concerns not in spec" addenda appended to pV2-02 + pV2-03 ship reports
- CC found 6 additional concerns during retroactive re-read (including the cookie-set/clear mismatch which became AUDIT-02 Fix 4b)

CC's refinements absorbed:
- Rule 1: mandates `withTransaction(fn)` helper, not hand-rolled BEGIN/COMMIT
- Rule 2: compile-time enforcement via Tailwind palette replacement + complete semantic token set
- Rule 9: hygiene rules outrank spec-embedded code (the precedence meta-rule — CC's contribution)

Verified: 6/6 acceptance + CC's retroactive concerns pass found 6 additional items.

---

### 2026-06-11 — pV2-03: Team management (Settings → Team)

v2.05a. Org admins list / invite / role-toggle / suspend / remove members of their own org.

What changed:
- New route `/settings/team` (admin-gated via `adminGuard`)
- Row layout: avatar + name + job title + email + Admin toggle + Suspend toggle + Trash
- Invite modal: email (required), name + job title (optional), Admin checkbox
- Server `routes/team.js` with self-modification / cross-org / last-admin guards
- LIVE membership read per request — suspension bites on next call
- Pending invitees stub a `users` row with no `google_sub`; on first sign-in via email match, row links + status flips invited→active
- pV2-02 upsert extended to handle linking + default_org_id backfill

Verified: 12/12 acceptance; v1 unchanged; first-sign-in linking confirmed end-to-end with `liam@nike.example` fixture.

Concerns flagged: `errorDetail()` extraction trigger on second consumer; popover not keyboard-navigable (a11y note for later).

---

### 2026-06-10 — pV2-02: Google OAuth + users + roles + dev picker

v2.04a. Real authentication wired in.

What changed:
- `passport-google-oauth20` on server, JWT in HTTP-only cookie
- New tables: `users` (reshape — additive: added `google_sub`, `display_name`, `default_org_id`) + `user_orgs` (membership with `is_admin` boolean + `job_title` + status)
- Permissions matrix in both client + server (`can()`, `effectiveRole()`)
- Signal-based `AuthService` driving session state
- Route guards (`auth.guard`, `admin.guard`)
- Login + auth-callback pages replace pV2-01b placeholders
- Hello page shows logged-in user
- Self-signup → agency_admin of new "Liam Wood's Workspace" org (deferred replacement to pV2-02b)
- `POST /auth/dev/login` + `GET /api/dev/users` (dev-only)
- 4 dev-seed users (Sarah / Beth / Ryan / Alex)

Verified: 17/17 acceptance + Google OAuth roundtrip confirmed live.

Concerns flagged silently at ship (caught by post-prompt audit):
- Step 3 upsert not transactional (orphan risk) — fixed in AUDIT-02
- Auto-org-create UX behavior (spec drift) — fixed in pV2-02b
- JWT carries `role`/`is_admin` for 7 days (staleness window) — fixed in AUDIT-02
- Silent error swallowing in `loadSession()` — fixed in AUDIT-02
- Raw Tailwind color values in subsequent pV2-03 work — fixed in AUDIT-02

---

### 2026-06-09 — pV2-01f: Brand visual pass

v2.02c. Vivid gradient + size parity.

What changed:
- `--bp-gradient` redefined to vivid pink → green (`#d63384` → `#16a34a`) — was soft pastel
- New `--bp-text-on-gradient: #ffffff` token
- Avatar circle: vivid pink+green fill, white initials (logo treatment)
- Ballpark wordmark vs SM avatar initials brought to exact visual parity (root cause: font weight inheritance mismatch — fixed to 600 + line-height 1 + explicit `--bp-font`)

Verified: visual screenshot compared B vs S pixel heights — match within 1px.

---

### 2026-06-09 — pV2-01e: Brand config from DB

v2.03a. The first real v2 → API → Postgres round-trip.

What changed:
- New `bp_brand_config` table seeded with `font_pair`, `gradient`, `text_color`
- New `GET /api/brand` (public, unauthenticated — needed pre-login for landing page)
- New `BrandConfigService` loads at bootstrap before Angular boot, applies values to `:root` as `--bp-*` overrides
- `styles.css` defaults stay as fallback (no FOUC if API down)

Verified live: changed DB row → refreshed → wordmark switched to Georgia serif → restored → back to Inter Tight.

---

### 2026-06-09 — pV2-01d: Visual tweaks (transparent + borderless)

v2.02b. Two follow-ups from QC.

What changed:
- `<app-page-hero>` default `accent` flips from `'theme'` to `'none'` (transparent default; theme wash opt-in)
- `<app-shell>` header drops `border-bottom`
- `/style/hero` rearranged to keep one `accent="theme"` example for variant QC

---

### 2026-06-09 — pV2-01c: Page hero `<app-page-hero>`

v2.02a. Standard hero band used at the top of every feature page.

What changed:
- New `<app-page-hero>` with title (required) + subtitle + back link + accent variants + align variants + `hero-actions` ng-content slot
- Uses `host:`-binding pattern (component IS the band, no inner wrapper) per pV2-01a
- `input.required<string>()` for title
- `@let` in templates that consume signals
- Hello page updated to use it
- New `/style/hero` demo route showing 4 variants for visual QC

---

### 2026-06-09 — pV2-01b: Shell chrome

v2.01a. Transparent header + avatar widget + footer chip.

What changed:
- `<app-user-avatar>` (initials with theme-soft gradient, configurable size — used at 40px header / 36px menu hdr / 28px login picker / 24px menu rows / 44px hello)
- `<app-user-menu>` (avatar + PrimeNG popover with current user / "Switch user (dev)" submenu / Sign out)
- `<app-shell>` (transparent header + router-outlet + footer chip)
- `<app-version-chip>` (fixed bottom-right monospace chip)
- `<app-wordmark>` (Ballpark text mark)
- Stub `AuthService` holds 4 fake users (Sarah/Beth/Ryan/Alex)
- `/login` shows Google CTA (stubbed warn) + dev picker side-by-side
- Brand tokens `--bp-gradient` + `--bp-text-color` + `--bp-font` defined for the first time

---

### 2026-06-09 — pV2-01a: Host-binding standard codified

Docs-only. Adds "Component is the element — no wrapping" rule to WORKING_STANDARDS § Angular Component Standards.

---

### 2026-06-09 — pV2-01: Scaffold `client-v2/`

v2.00a. Fresh Angular workspace alongside v1.

What changed:
- New `client-v2/` workspace at Angular 21 + PrimeNG 21 (Aura preset) + Tailwind + Lucide
- Standalone-only, OnPush mandatory, strict TS, esbuild builder
- Runtime-configurable API URL via `/runtime-config.json` loaded at bootstrap
- One `--theme-*` token bridge file (via `definePreset`) replaces v1's 160 `.p-*` overrides with ONE place
- Runs on port 4201 alongside v1 on 4200
- Hello-world page proves the stack
- Login + auth-callback placeholders for pV2-02
- Old `client-angular/` UNTOUCHED

Setup deviations (all flagged): Angular 21 not 22 (PrimeNG 21 doesn't support Angular 22 yet); `@primeuix/themes` not `@primeng/themes` (latter is deprecated); `lucide-angular@0.577` kept (new package dropped `.pick()`); `definePreset` not CSS overrides (styled mode clobbers CSS overrides); `runtime-config.json` in `public/` not `src/`; `provideAppInitializer` not bootstrap-then-load.

---

### 2026-06-10 — p0038A: Angular upgrade v17 → v18 (legacy v1)

v1.70a. Backed up first (tag `pre-angular-upgrade-v1.69e`), audited via `ng update --dry-run`, then executed v17 → v18 holding PrimeNG at 17.

Verified: all smoke-test routes pass; old v1 app still functional; `/marketplace` + cart drawer (highest PrimeNG surface) clean.

---

## v1 prompts archive

For the full v1 prompt history (p0001 through p0038), see `prompts/backlog.md`.
Reading order doesn't matter — the v1 home dashboard reference set is:

- **p0014** — Agent Home restyled with marketplace chrome
- **p0017** — `<app-page-config-drawer>` migration (GENERAL / APPEARANCE / SECTIONS)
- **p0018** — Dashboard SECTIONS checkbox toggles
- **p0019** — `<app-action-tile>` extraction + 5-card launcher grid
- **p0023** — Hero customisation (Title dropdown / Subtitle / Hero color)
- **p0024** — `/projects` landing page
- **p0031** — Project card refresh
- **p0032** — Hero color global + drawer two-tab reorganisation (Dashboard / General)
- **p0033** — Role-keyed top-nav + `/agent` consolidation

Use these as design references for pV2-04 (agent home) and pV2-05 (supplier
home). Per Rule 9 (hygiene precedence), implement v2 patterns when v1 prompts
contain v1-era code samples.
