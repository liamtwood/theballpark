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
(chat fills this in — leave the section header so chat finds it)

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
