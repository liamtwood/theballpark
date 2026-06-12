# pV2-05 — Supplier home: the v1.68w three-tile launcher port

> Shipped CHAT-DRIVEN from Liam's v1 reference screenshot before a formal
> pV2-05 prompt was written (the backlog had it earmarked but deferred).
> If chat writes the prompt retroactively, this file is its shipped record.

**Shipped:** 2026-06-12, chip `[Dev v2] v2.12f`
**Commits:** `6534b3e` feat(v2.12f): supplier home — v1.68w three-tile port [pV2-05 core]

## What landed
- `SUPPLIER_TILES` in the launcher registry — the v1.68w supplier home
  verbatim (Liam's screenshot): **Projects** (folder-open) → `/projects`,
  **Inbox** (inbox) → `/inbox`, **Marketplace Profile** (store) →
  `/marketplace-profile` (new stub route). Same centred launcher master,
  same greeting/page-settings plumbing.
- `tilesForOrgType(orgType)` replaces the role ternary in home-agent:
  ballpark → 2 admin tiles, supplier → 3, agency → 5. One switch, one
  registry.
- `tileForPath(path, orgType?)` is org-aware: sets share hrefs
  (`/projects`, `/inbox`) with different copy, so a supplier's stub hero
  shows supplier copy, agent's shows agent copy. coming-soon passes the
  viewer's `activeOrgType`.

## Files touched
| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| client-v2/src/app/shared/launcher/agent-tiles.ts | +44 / −5 | 6534b3e | SUPPLIER_TILES + tilesForOrgType + org-aware tileForPath |
| client-v2/src/app/pages/home/home-agent.component.ts | +4 / −5 | 6534b3e | org-type switch |
| client-v2/src/app/pages/stub/coming-soon.component.ts | +5 / −1 | 6534b3e | AuthService inject + orgType arg |
| client-v2/src/app/app.routes.ts | +6 / −0 | 6534b3e | /marketplace-profile stub |
| client-v2/src/environments/environment.ts | +1 / −1 | 6534b3e | chip v2.12f |

## Acceptance — 5 / 5 verified (live on 4201 as seeded Ryan / Rocket Food)
- Supplier /home shows exactly the three v1 tiles with v1 copy — ✓
- Tile icons render (folder-open / inbox / store, already in the global
  pick) — ✓
- /marketplace-profile routes to a stub whose hero carries the tile's
  title/subtitle — ✓
- Supplier's /projects stub shows SUPPLIER copy ("Manage active
  opportunities…"), not the agent's — ✓ (org-aware tileForPath)
- Agent + admin homes unchanged; build, lint, style guard green, 54/54
  specs — ✓

## Concerns not in spec
### Inbox unread badge deferred
**Where:** SUPPLIER_TILES Inbox entry (v1 put an unread-thread count badge
on this tile).
**What:** v1 counted client-side off the FULL supplier message list — an
unbounded fetch for a badge; not ported as-is. Needs a v2 count endpoint
(e.g. GET /api/inbox/unread-count) when the inbox arc lands.
**Severity:** LOW

### Tile labels are fixed copy
**Where:** SUPPLIER_TILES 'Projects' label
**What:** v1 derived this label from the configurable Events label
(pluralised); v2 ships it as fixed copy like the rest of the Figma tile
strings. Wire to `eventLabel` config if per-role labels matter.
**Severity:** LOW

## QC notes
**2026-06-12 (Liam):** "qc supplier good, admin good" — supplier + admin
homes ACCEPTED. Agent issue raised: both project tiles targeted /projects
→ fixed in the v2.12g iteration below.

## Chat audit
**Audit pass: 2026-06-12, chat** — covers v2.12f through v2.13b (4 chips, 4 commits).

### Verified ✓

- **v2.12f supplier home** — three-tile port of v1.68w via `SUPPLIER_TILES` in the launcher registry. `tilesForOrgType(orgType)` replaces the role ternary in `home-agent` — cleaner one-switch dispatch (ballpark→2 / supplier→3 / agency→5). `tileForPath(path, orgType?)` is org-aware so shared routes (`/projects`, `/inbox`) render per-role copy without separate routes. One Definition + role-aware rendering — the right shape we discussed in chat.
- **v2.12g agent tile split** — New Project → `/projects/new` and Projects → `/projects`. CC's subtitle realignment (judgment call when Liam specified labels + targets only) flagged in iteration log — good ship-report discipline.
- **v2.13a sub-hubs** — both v1 supplier sub-hubs ported: `/projects-hub` (Quoting / Live / Completed via `?bucket=` query) and `/marketplace-profile` (later → `/storefront`). New optional `query` input on `<app-launcher-tile>` for cases where routerLink can't carry `?bucket=`. Hub depth = two clicks to a bucket; recorded as watch item for supplier QC (would flatten by promoting buckets to home grid if QC surfaces it).
- **v2.13b renames + §14 enforcement** — `agent-tiles.ts` → `launcher-tiles.ts` (`git mv`, history preserved, 4 imports repointed). "Marketplace Profile" → "Storefront" across tile label / hub title / route / component, per DESIGN.md §14. **Bonus catch:** the same §14 read surfaced `/my-shop` as a hard-coded customer label in an internal route → fixed to `/store` (UI label "My Shop" preserved). This is the audit discipline working — reading the canonical reference and noticing past slips.

### Standards conformance

- All new components (`StorefrontComponent`, `ProjectsHubComponent`) are standalone + OnPush per v2 hygiene.
- All tile chrome resolves through the locked TYPE-01 role classes (no raw font/size literals would have compiled past the guard).
- §14 internal naming honored — `storefront` for public-face hubs, `store` for catalogue routes.
- `<app-launcher-tile>` extension (optional `query`) is additive — no breaking change to existing consumers.

### Concerns flagged

- **Inbox unread badge deferred** — supplier v1 had a count badge on the Inbox tile, counted client-side off the FULL message list (unbounded fetch). Needs a v2 `GET /api/inbox/unread-count` endpoint when the inbox arc lands. Flagged in shipped file; ledger note.
- **Tile labels are fixed copy** — v1 derived "Projects" from configurable `eventLabel` (pluralised); v2 ships fixed copy. Wire to `eventLabel` config if per-role labels matter. Low.
- **Live counts on `/projects-hub` deferred** — needs v2 projects count endpoint (v1 fetched every project + bucketed client-side, an unbounded fetch). Same pattern as inbox badge — both await proper count endpoints.
- **Hub depth (2 clicks to a bucket)** — watch item for customer-supplier QC next week per shipped file. If "too many clicks" surfaces, flatten by promoting buckets to home grid.

### Verdict

**Done.** Backlog row added + flipped Shipped → Done. Three role-typed homes now live (ballpark / agent / supplier) with sub-hubs on the supplier surface. The launcher master + single registry + org-aware tile resolution combine into a clean foundation for the page arcs that build on top (projects, inbox, marketplace, store).

## Iteration — v2.12g (2026-06-12)
**Triggered by QC:** "New Projects go to New Project and Past Project
change to Projects and the target remains /projects."
**Commit:** `8b367ab`
**Files:** agent-tiles.ts (New Project → /projects/new, subtitle "Start a
new project."; "Past Projects" relabeled "Projects", keeps /projects with
the old New-Project subtitle which always described the list; stale
FIRST-match note removed); app.routes.ts (+/projects/new stub, feature
"New Project"); chip.
Verified on 4201 as Sarah: tiles [New Project → /projects/new, Projects →
/projects, Inbox, Marketplace, Profile]; both stubs render their own hero
copy. NOTE: subtitle realignment was CC judgment (Liam specified labels +
targets only) — flag at QC if different copy is wanted.

## QC notes — addendum (2026-06-12)
**Liam:** "qc - perfect" — v2.12g agent tile split ACCEPTED. All three
homes (admin / agent / supplier) QC-passed.

## Iteration — v2.13a (2026-06-12)
**Triggered by QC:** "supplier we have sub pages for project and
Marketplace Profile... see from v1" → "yes please".
**Commit:** `c222e38`
**What shipped:** both v1 supplier sub-hubs, on the launcher master:
- /projects-hub (v1.68t): title = configurable event label pluralised
  ("Projects"), three stage tiles — Quoting / Live Projects / Completed
  Projects — drilling into /projects?bucket=quoting|live|completed.
  Live tile counts DEFERRED (needs a v2 projects count endpoint; v1
  fetched every project and bucketed client-side).
- /marketplace-profile (v1.68o, replaces the stub): Marketplace →
  /marketplace, My Shop → /my-shop (new stub), Profile → the REAL
  /settings/profile.
- LauncherTile gained optional `query` (string routerLink can't carry
  ?bucket=); supplier home Projects tile retargeted → /projects-hub;
  tileForPath fallback includes the hub sets so /my-shop's stub hero
  carries the tile copy; +5 Lucide icons in the global pick.
**Verified on 4201 as Ryan:** home → hub → stage tiles with query params;
marketplace-profile trio renders with icons; My Shop stub hero correct;
Profile tile lands the real Profile (Company Information / Financial
defaults). Build, lint, guards green; 54/54 specs.

## QC notes — addendum (2026-06-12)
**Liam:** "qc - will need some discussion but what you did was perfect" —
v2.13a sub-hubs ACCEPTED as built (faithful v1 port); the hub structure
itself is open for a design discussion with chat before the projects /
marketplace arcs build on it.

## Iteration — v2.13b (2026-06-12)
**Triggered by:** chat's three flags (pasted by Liam).
**Commit:** `aa6ab80`
1. agent-tiles.ts → **launcher-tiles.ts** (git mv — holds all role sets).
2. "Marketplace Profile" → **"Storefront"** (tile label, hub title, route
   /marketplace-profile → /storefront, StorefrontComponent). §14:
   storefront = the public-face hub.
3. Bonus §14 fix surfaced by the same pass: /my-shop → **/store** (internal
   names never hard-code customer labels; "My Shop" stays as UI copy).
4. Flag 3 (hub = two clicks to a bucket) — WATCH ITEM for supplier QC; if
   "too many clicks" surfaces, promote the stage buckets onto the home
   grid directly.
No redirects: the old URLs never shipped beyond dev.
**Verified on 4201 as Ryan:** home shows Storefront → /storefront; hub
titled Storefront with Marketplace / My Shop (/store) / Profile; /store
stub hero "My Shop". Build, lint, guards green; 54/54.

## QC notes — final (2026-06-12)
**Liam:** "works for me" — v2.13b Storefront rename ACCEPTED. Customer
review of the supplier surface planned next week; the hub-depth watch item
(two clicks to a bucket) is the thing to listen for there.

## Iteration — v2.13c (2026-06-12, evening housekeeping)
**Triggered by:** Liam ("you have more to do this week ;)") — autonomous
pass over the parked chores.
**Commits:** `544db43` (test + fix), `9c26b62` (server audit)
- launcher-tiles.spec.ts written (7 specs — the registry lost coverage
  when dev-personas died). Writing it SURFACED a real regression: since
  the supplier home tile moved to /projects-hub, a supplier on /projects
  fell back to AGENT copy, and bucket drills showed the generic hero.
- Fix: tileForPath matches declared query params (precedence: org set >
  query-specific > plain); coming-soon passes route queryParams.
  Verified live: /projects?bucket=quoting renders the "Quoting" hero.
  62/62 specs.
- chore(server): npm audit fix — 10 vulnerabilities → 0 (2 high ReDoS:
  path-to-regexp, picomatch). Non-breaking only; 29/29 server tests; live
  API verified post-bump. v1-client audit deferred (retires pV2-11; its
  remaining advisories need --force).
