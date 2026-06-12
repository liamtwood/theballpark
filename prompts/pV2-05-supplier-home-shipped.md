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
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
