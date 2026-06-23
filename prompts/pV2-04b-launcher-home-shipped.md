# pV2-04b — Launcher-only `/home` for agent · SHIPPED

**Status:** Shipped (awaiting chat audit pass before Done)
**Version chip:** `[Dev v2] v2.09c`
**Branch:** dev — revert + three feature commits + this ship commit.

## ⚠ Migration (you said you'd run it after ship)

```
cd server && npm run db:migrate:schemas
```

Until it runs, drawer saves 500 and the optimistic update visibly rolls back (verified working — it's the designed failure mode). Acceptance **12–14 (persist / reload-restore / cross-admin) need it** and go green with zero code change after; everything else is verified now.

## Commits

| SHA | What |
|---|---|
| `67ce49d` | Hard-revert of pV2-04 (6 commits, 54bde79..43fdb82) |
| `b0f2958` | org_type_config re-added to migrate-schemas (v2 vocabulary CHECK: agency/supplier/**ballpark**; full audit cols; guarded `audit.add_audit_columns`) + ConfigService org_type normalisation + getV2Home/setV2Home jsonb_set merge + dual-auth config routes + slim PageConfigSchema (General fields only) + PageConfigService + single-body drawer + select/input rows + typography tokens (`--font-display`/`--font-body`/`--color-text`) + Playfair/Libre Franklin font loading |
| `dce73c5` | `<app-home-launcher>` MASTER (centred display-face chrome + auto-fit tile grid, top-anchored per the v1.68o lesson, align-left variant) + `<app-launcher-tile>` (routerLink card, gradient primary) + `LauncherTile` types + `<app-coming-soon>` stub |
| `0e4bbaf` | `<app-home-agent>` at /home (hello retired) + cog + drawer integration + 4 stub routes + chip v2.09c |

## Acceptance — 22 ✓ · 3 pending migration

- ✓ 1 `/home` renders `<app-home-agent>` (dev-session mechanics identical to Google)
- ✓ 2 **No page-hero band** — `app-page-hero` absent from the DOM; the launcher owns the chrome
- ✓ 3 Centred Playfair title "Welcome back, Sarah" + default subtitle + 5-tile grid
- ✓ 4 First tile gradient + white text (computed background-image verified)
- ✓ 5 Other 4 tiles surface + secondary
- ✓ 6 Tiles route to /projects, /inbox, /marketplace, /settings/profile stubs
- ✓ 7 Mobile (<768px) stacks to 2 columns (computed grid verified at 375px)
- ✓ 8 Cog renders only for admins — note the gate deviation below
- ✓ 9 Cog → right p-drawer opens
- ✓ 10 **Zero tabs** in the drawer (single body)
- ✓ 11 7 rows: Title select, conditional Title-text (mode=fixed), Subtitle, Align, 3 label inputs
- ✗ 12–14 auto-save persist / reload restore / cross-admin — **pending the migration**; optimistic apply + rollback-on-failure verified live in the meantime
- ✓ 15 Alex (member): no cog
- ✓ 16 Member direct PUT → 403
- ✓ 17–19 hygiene greps zero; raw-color guard green; host: bindings everywhere
- ✓ 20 All pV2-04b icons in the GLOBAL pick (Settings, X, FolderPlus, FolderOpen, Inbox, Store, CircleUser) — per the updated DESIGN.md §12
- ✓ 21 checklist walk below
- ✓ 22 PageConfigSchema (Zod, strip-unknown) validates the PUT
- ✓ 23 v1 on 4200: root 200, APIs 200
- ✓ 24 Dev-user switch updates greeting + cog visibility (Sarah → Alex verified)
- ✓ 25 **v1 `/home` 200** — v1's HomeComponent launcher serves unchanged

Suites: 51 client + 24 server specs; build + lint + raw-color guard clean.

## API audit checklist walk — `PUT /api/config/:orgType` (modified)

- ✓ Method: PUT — same body twice → same end state (jsonb_set idempotent)
- ✓ Mount: documented dual-auth exception — same URL serves v1 (x-bp-user-id platform-admin path, byte-for-byte untouched) and v2 (cookie → authenticate + `requireActiveMembership('org.invite_member')`); shim dies with v1 (pV2-11)
- ✓ Authz: v2 admins write THEIR OWN org_type only (live `req.user.org_type` vs param, normalised) — cross-type → 403
- ✓ Input: `:orgType` allow-list; body via PageConfigSchema (enums, trimmed length bounds, strip-unknown); 400 `{ error, details }`
- ✓ Status codes: 200 / 400 / 401 / 403 (member; cross-type) / 500 pre-migration
- ✓ Response: the persisted v2Home slice; one error shape; no PII / schema names
- ✓ Write safety: single-statement upsert — no read-modify-write race with v1's full-payload writes
- ✓ Performance: single-row PK upsert
- (GET also touched — same dual-auth; v2 response is the v2Home slice; 401 without cookie verified)

## Concerns not in spec

### Spec-hygiene precedence deviations (Rule 9)

1. **Cog gate: `can(role, 'org.invite_member')`, not the sketch's bare `isAdmin`** — the cog must match the server's PUT gate. A ballpark_admin has `isAdmin === true` but cannot author org config; the sketch's gate would render a cog whose drawer 403s on every save.
2. **`--font-display` / `--color-text` didn't exist in v2** — the sketch referenced them but v2 loaded no display face and defined neither token. Added the tokens + the Playfair Display / Libre Franklin Google-Fonts pair per DESIGN.md §5 (v1 loads the same pair). First time v2 renders an editorial serif — QC the title's look.

### Findings

3. **`org_type` vocabulary unified at the service boundary** — the spec's table CHECK says `ballpark` but v1 writes `admin` (and v1's VALID list had no `ballpark`). ConfigService now normalises on the way in: both vocabularies read/write the ONE `ballpark` row. Without this, post-migration v1 platform-admin PUTs would have violated the CHECK constraint and 500'd.
4. **v1 reference code is consistent with v2 patterns in spirit, two notes:** v1's launcher title is explicitly ui-sans at 60px (not the display serif the v2 sketch specifies — the spec's 36px Playfair is a deliberate v2 restyle, shipped as spec'd at 44px to sit between the two; flag if you want v1's exact 60px sans instead); v1's LauncherTile carries `subtitle`/`badge`/`meta` per tile — the v2 interface is deliberately label-only per the sketch, so the supplier home (pV2-05) will need the interface extended when it ports the badge'd Inbox tile.
5. **"Add project" routes to `/projects`** per the spec's tile table (v1 opened the create-project modal). When the projects arc lands, this tile probably wants the create modal back rather than the same target as "View projects" — both currently navigate to the identical stub.
6. **pV2-04-era payloads degrade silently** — strip-unknown drops the dead section flags/heroColor if any v2Home payload had persisted them (none could have — the table never existed — but belt and braces).
7. **Drawer chrome is Aura-default** — v1's parchment bp-drawer styling isn't ported; same note as pV2-04's report. QC may want a styling pass.
