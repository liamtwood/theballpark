# Ballpark v2 — Audit Ledger

Tracks every audit pass per file: when it was audited, by whom, against
what standard, and the file's size + SHA at audit time. When a file's
current SHA differs from its recorded SHA, it's drifted since audit and
needs a re-pass.

**Soft caps to prevent bloat** ("behemoth watch"):

| File kind | Warning | Alarm |
|---|---|---|
| Component (`*.component.ts`) | 250 lines | 400 lines |
| Service (`*.service.ts`) | 200 lines | 350 lines |
| Route file (server) | 200 lines | 300 lines |
| Schema / types / helpers | 150 lines | 250 lines |

Files at Warning trigger a "consider extracting" note in the next audit
pass. Alarm requires extraction before the next ship lands on that file.

**Auditor codes:** `chat` = code review by Claude chat; `cc` = code review
by Claude Code; `both` = audited and re-verified.

---

## Risk patterns — read before every audit

QC findings sharpen the next audit. When a bug class emerges, log it here
and grep against it across every subsequent audit pass. Each audit closes
out any pattern it disproves.

| # | Pattern | First seen | Status | Grep / check |
|---|---|---|---|---|
| RP-01 | Sequential fetch chains in component init AND idle-DB-pool reconnect stalls (TCP+TLS+auth after node-postgres drops idle conns) | Profile slow load (v2.11g QC) | partial fix v2.12 (pool keepalive 10min in `server/src/db/pool.js`) + v2.12c (boot initializers parallel: rc → [brand ∥ auth] → page-config; 983ms → 238ms). Cold-start login still slow — PARKED by Liam. | grep `firstValueFrom` inside `resource()` loaders without `Promise.all`; if cold-start picked back up, measure OAuth callback → first-paint window |
| RP-02 | "Simplifications" wrapped over deeper plumbing that lose the user's intended semantic | Persona switcher Liam→Beth (v2.11g QC); persona-chain Liam → Ryan → Sarah (v2.12b QC) | **CLOSED BY REMOVAL** v2.12d. Surface eliminated — header switcher gone, `/auth/orgs` + `/auth/switch-org` removed, `dev-personas.ts` deleted, one-account-one-role model adopted. Discovery preserved as learning. | re-open if a future real org-switcher surfaces customer-side |

Each future audit pass reads this section first and verifies every open
row's check against the current ship's surface area.

## How to use this ledger

1. **After every ship** — the chat audit-before-shipped pass updates rows
   for every file touched in that ship report, recording the new SHA + line
   count + date.
2. **Before any non-trivial code change** — author checks the row for that
   file. If "Last audited" is older than the file's last commit (SHA
   mismatch), audit-before-shipped is mandatory before the next merge.
3. **Periodic sweep** — once a month or before a major arc starts, run a
   pass over every row whose recorded SHA differs from current HEAD. Flag
   any new files in the tree that aren't in the ledger yet.
4. **Bloat watch** — any row whose line count hits Warning gets a
   "consider extracting" note; Alarm blocks the next change on that file.

**Status legend:**

- `✓ clean` — audit passed, no open concerns
- `✓ flagged` — audit passed but with minor concerns logged in Notes
- `△ drifted` — file changed since last audit; needs re-pass
- `○ unaudited` — never had a formal audit pass

---

## Client (v2) — Pages

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/pages/landing/landing.component.ts` | 38 | `960ab5a` | — | — | ○ unaudited | Public landing, pV2-02b ship |
| `client-v2/src/app/pages/login/login.component.ts` | 36 | `e842a00` | 2026-06-12 | chat | ✓ clean | v2.12e: dev picker + devUsers resource + redirect effect REMOVED. Single Google-branded button on `.bp-btn-outline` chrome. `public/google-g.svg` brought in as ASSET (not inlined SVG) so style guard never scans the G mark's brand hex. Shrunk 83→36 lines. |
| `client-v2/src/app/pages/auth-callback/auth-callback.component.ts` | 38 | `8f2a47b` | — | — | ○ unaudited | OAuth callback |
| `client-v2/src/app/pages/onboarding/onboarding.component.ts` | 162 | `3714904` | — | — | ○ unaudited | Agency/Supplier radio tiles, pV2-02b ship |
| `client-v2/src/app/pages/onboarding/org-name-default.ts` | 23 | `ca5639c` | — | — | ○ unaudited | Helper |
| `client-v2/src/app/pages/home/home-agent.component.ts` | 36 | `f7884c1` | 2026-06-12 | chat | ✓ clean | v2.12f: role ternary replaced with `tilesForOrgType(orgType)` from launcher-tiles registry — clean one-switch dispatch ballpark→2 / supplier→3 / agency→5. One Definition holds. |
| `client-v2/src/app/pages/home/hero-title.ts` | 33 | `8e4ef60` | — | — | ○ unaudited | Title-mode resolver |
| `client-v2/src/app/pages/settings/team/team.component.ts` | 184 | `d2171f2` | — | — | ○ unaudited | pV2-03 ship; cap approaching (250) |
| `client-v2/src/app/pages/settings/team/team-member-row.component.ts` | 86 | `5d5af22` | — | — | ○ unaudited | Member row chrome |
| `client-v2/src/app/pages/settings/profile/profile.component.ts` | 170 | `4467616` | 2026-06-11 | chat | ✓ flagged | Re-audited at v2.11g. Typography + structure match locked v2 edit-form standard (`<app-edit-section>` + `<app-edit-field>` at page density). "Organisation" → "Company Information" retitle landed in v2.11e. canEdit gate still blocks Liam (ballpark_admin lacks `org.manage_billing`) — pending matrix change in in-flight ballpark-home work. |
| `client-v2/src/app/pages/settings/pages/pages-settings.component.ts` | 162 | `8e750f4` | 2026-06-11 | chat | ✓ flagged | Audited at commit `ae27fc8` (v2.10d). TYPE-01 classes ✓, no raw colors, two-layer auth, jsonb_set merge-write, audit columns + triggers on DB. Six minor concerns logged in chat transcript: updated_by not surfaced, no created_by stamping on first INSERT, no ballpark row yet, no save confirmation, title-mode 'username'/'orgName' show admin's own data not edited org's, permission semantic conflation (`admin.cross_org_view` doubling as page_config gate). |
| `client-v2/src/app/pages/stub/coming-soon.component.ts` | 36 | `4b754ea` | 2026-06-12 | chat | ✓ clean | v2.12f: AuthService inject + orgType arg → org-aware `tileForPath` so a supplier's stub hero shows supplier copy, an agent's shows agent copy. Stub hero plumbing One Definition. |
| `client-v2/src/app/pages/style/hero/hero-demo.component.ts` | 62 | `0b3fa16` | — | — | ○ unaudited | Dev-only style sandbox |

## Client (v2) — Shell

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/shell/app-shell.component.ts` | 37 | `054ce72` | 2026-06-11 | chat | ✓ clean | Re-audited at v2.11g. Header now sticky + opaque (v2.11d — `bg-bg` instead of transparent); page-hero scroll-over fixed. Still 37 lines. |
| `client-v2/src/app/shell/page-hero/page-hero.component.ts` | 132 | `788f67c` | 2026-06-11 | chat | ✓ clean | Re-audited at v2.11g. Separator removed in v2.11d; title rides `--text-hero` (40); subtitle rides `--text-xl` (18) post v2.11g ramp. |
| `client-v2/src/app/shell/user-menu/user-menu.component.ts` | 89 | `b673317` | 2026-06-12 | chat | ✓ clean | v2.12d: persona switcher removed. Shrunk 126→89 lines (-29%). Identity is now stable across session — no header-side identity-swap surface. |
| `client-v2/src/app/shell/version-chip/version-chip.component.ts` | 31 | `3c61288` | — | — | ○ unaudited | `[Dev v2] vX.YYz` chip, fixed bottom-right |

## Client (v2) — Shared components + primitives

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/shared/edit-field/edit-field.component.ts` | 205 | `9fae040` | 2026-06-11 | chat | ✓ flagged | Re-audited at v2.11g. 3 value-color pins added for `.bp-fld` chrome → `--color-text-strong` (PrimeNG select + inputnumber adapters). **Still at warning band (205/250)** — extract type-specific bodies (text vs select vs number) when next touched. |
| `client-v2/src/app/shared/edit-section/edit-section.component.ts` | 69 | `6b3fe17` | 2026-06-11 | chat | ✓ clean | Rewritten v2.11c — hover-pencil retired; bottom-left `.bp-card-foot` row with Edit / Cancel / Save changes per v1 standard; `.bp-edit-section-title` baked in. 45 lines lighter, cleaner template. The reference primitive for the locked edit-form pattern. |
| `client-v2/src/app/shared/launcher/home-launcher.component.ts` | 153 | `bf94771` | — | — | ○ unaudited | Master component (used by home + future ballpark home). pV2-04b1-qc QC'd. |
| `client-v2/src/app/shared/launcher/launcher-tile.component.ts` | 93 | `58dcbc1` | — | — | ○ unaudited | Tile chrome; pV2-04b2-qc QC'd through hover + rounding fixes |
| `client-v2/src/app/shared/launcher/launcher-tiles.ts` | 156 | `e264576` | 2026-06-12 | chat | ✓ clean | Renamed v2.13b from `agent-tiles.ts`. Holds AGENT_TILES (5), SUPPLIER_TILES (3), BALLPARK_TILES (2), STOREFRONT_HUB, PROJECTS_HUB. `tilesForOrgType(orgType)` is the dispatch; `tileForPath(path, orgType?)` is org-aware so shared routes (`/projects`, `/inbox`) render per-role copy. v2.13b §14 catch: `/my-shop` → `/store` (internal name follows §14 storefront/store distinction, UI label "My Shop" preserved). |
| `client-v2/src/app/pages/supplier/storefront.component.ts` | — | — | 2026-06-12 | chat | ✓ clean | v2.13b: replaces stub `/marketplace-profile`. Hub launcher (Marketplace / My Shop / Profile). Title "Storefront" per §14. |
| `client-v2/src/app/pages/supplier/projects-hub.component.ts` | — | — | 2026-06-12 | chat | ✓ clean | v2.13a: supplier sub-hub for project buckets (Quoting / Live / Completed). Bucket query params via new LauncherTile.query input. Live counts deferred (needs v2 projects count endpoint). |
| `client-v2/src/app/shared/launcher/launcher-tile.types.ts` | 9 | `af326ca` | — | — | ○ unaudited | Type defs |
| `client-v2/src/app/shared/user-avatar/user-avatar.component.ts` | 94 | `06e32de` | — | — | ○ unaudited | Initials circle + gradient + image variants |
| `client-v2/src/app/shared/wordmark/wordmark.component.ts` | 22 | `28d8621` | — | — | ○ unaudited | Brand wordmark |
| `client-v2/src/app/shared/public-header/public-header.component.ts` | 29 | `430fcbd` | — | — | ○ unaudited | Public landing header |

## Client (v2) — Core (services + auth + types)

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `client-v2/src/app/core/auth/auth.service.ts` | 101 | `d239b9b` | 2026-06-12 | chat | ✓ clean | v2.12d: `listDevUsers` removed; `devLogin` retained for tooling/QC against the still-live `POST /auth/dev/login`. Identity surface tightened. 115→101 lines. |
| `client-v2/src/app/core/auth/permissions.ts` | 33 | `1e53850` | 2026-06-11 | chat | ✓ clean | Matrix verified post-PAGES-01: ballpark_admin → `admin.cross_org_view` only (page_config.edit not added — deferred concern). |
| `client-v2/src/app/core/auth/dev-personas.ts` | — | — | 2026-06-12 | chat | DELETED (v2.12e) — zero consumers post login simplification; 57→54 specs. |
| `client-v2/src/app/core/auth/admin.guard.ts` | 14 | `0d1171a` | — | — | ○ unaudited | Generic admin guard |
| `client-v2/src/app/core/auth/ballpark-admin.guard.ts` | 15 | `df8df8b` | 2026-06-11 | chat | ✓ clean | New in PAGES-01. Checks `admin.cross_org_view`, redirects to `/home`. |
| `client-v2/src/app/core/auth/requires-org.guard.ts` | 16 | `e4c5831` | — | — | ○ unaudited | Bounces orgless users from /home |
| `client-v2/src/app/core/auth/needs-onboarding.guard.ts` | 13 | `c062760` | — | — | ○ unaudited | Inverse — bounces users WITH orgs from /onboarding |
| `client-v2/src/app/core/config/page-config.service.ts` | 63 | `e660e5f` | — | — | ○ unaudited | Reads org_type_config; called by home + table |
| `client-v2/src/app/core/config/page-config.types.ts` | 43 | `aeadfca` | — | — | ○ unaudited | Shared types between client + server |
| `client-v2/src/app/core/api.service.ts` | 52 | `8509346` | — | — | ○ unaudited | HTTP wrapper |
| `client-v2/src/app/core/brand-config.service.ts` | 51 | `ddcb960` | — | — | ○ unaudited | DB → `:root` runtime token bridge (`--bp-font` source) |
| `client-v2/src/app/core/runtime-config.service.ts` | 33 | `c4812e4` | — | — | ○ unaudited | `/runtime-config.json` bootstrap |
| `client-v2/src/app/core/team/team.service.ts` | 48 | `880ec91` | — | — | ○ unaudited | Team API |
| `client-v2/src/app/core/organisation.service.ts` | 36 | `a98c938` | — | — | ○ unaudited | Org API; profile page will use this |
| `client-v2/src/app/core/onboarding.service.ts` | 17 | `76ae001` | — | — | ○ unaudited | Onboarding API |
| `client-v2/src/app/core/http-error.ts` | 12 | `5821924` | — | — | ○ unaudited | Error type |

## Server — Routes + services

| File | Lines | SHA | Last audited | By | Status | Notes |
|---|---|---|---|---|---|---|
| `server/src/routes/config.js` | 132 | (see commit `ae27fc8`) | 2026-06-11 | chat | ✓ clean | PUT gate tightened to `admin.cross_org_view`; own-orgType check removed (platform admins write any row); Zod-validated; v1/v2 dual-auth shim documented for retire at pV2-11. |
| `server/src/services/config.service.js` | 108 | (see commit `ae27fc8`) | 2026-06-11 | chat | ✓ clean | jsonb_set merge-write avoids RMW races; v1 'admin' ↔ v2 'ballpark' boundary normalisation; degrades cleanly when migration absent (42P01 catch). |
| `server/src/schemas/page-config.schema.js` | 25 | (see commit `ae27fc8`) | 2026-06-11 | chat | ✓ clean | Zod schema; all fields optional (partial payloads valid); unknown keys stripped, not errored. |
| `server/src/services/permissions.service.js` | — | — | 2026-06-11 | chat | ✓ clean | Matrix mirrors client; `ballpark_admin → admin.cross_org_view`. |
| `server/src/middleware/require-active-membership.js` | — | — | — | — | ○ unaudited | Per-request live membership check |
| `server/src/middleware/authenticate.js` | — | — | — | — | ○ unaudited | JWT cookie auth |
| `server/src/services/auth.service.js` | — | — | — | — | ○ unaudited | Google OAuth upsert, deriveRole |
| `server/src/db/migrate-schemas.js` | (large — admin tool) | — | partial | chat | ✓ flagged | `org_type_config` migration verified for PAGES-01; audit columns + triggers correctly attached. Other tables not exhaustively re-audited. |

---

## Bloat watch — Files at or near soft caps

| File | Lines | Cap | Action |
|---|---|---|---|
| `client-v2/src/app/shared/edit-field/edit-field.component.ts` | 205 | 250 (component) | At warning. Extract type-specific bodies (text / select / number) into sub-components when next touched. Not blocking. |

(None at Alarm.)

## Bonus — styles.css

Not formally tracked above (rules vary widely) but worth noting: `client-v2/src/styles.css` is at **299 lines** as of v2.11g, SHA `aa8bb13`. Layer-1 tokens + ~25 Layer-2 role classes + §8 button chrome + drawer density variants. Healthy — central source of truth, no per-component CSS bloat.

---

## Drift watch — Files that changed since last audit

(Empty currently — all audited rows match their recorded SHA. Re-run the
SHA check before any non-trivial change to verify.)

---

## Files in tree but missing from ledger

(To detect, walk `client-v2/src/app/**` and `server/src/**` for `*.ts` /
`*.js` and diff against the ledger. Add new entries with status
`○ unaudited` on discovery. Currently believed complete as of 2026-06-11.)
