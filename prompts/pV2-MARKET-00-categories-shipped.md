# pV2-MARKET-00 — Categories backend + ballpark-admin curation table

**Shipped:** 2026-06-12, chip `[Dev v2] v2.14a`
**Commits:** `bb57393` feat(v2.14a): categories backend + /settings/categories curation table
**Spec:** `docs/MARKETPLACE.md` (arc row pV2-MARKET-00) + `prompts/pV2-06-angular-architecture.md`

## What landed
- `server/src/routes/marketplace.js` on the GATED v2 router: GET
  `/api/marketplace/categories` (active top-level catalogue categories +
  live item counts — the browse rail, any active member); GET
  `/categories/all` (incl. inactive — curation list) + PATCH
  `/categories/:id` (both `admin.cross_org_view`). PATCH = Zod
  `CategoryUpdateSchema` (name 2-60 / tagline ≤120 / isActive bool /
  sortOrder 0-999, refine non-empty), dynamic whitelisted single UPDATE,
  returns the fresh row with live count; 404 hides non-top-level /
  non-catalogue ids. Hierarchy/namespace/level NOT editable (curation
  surface, not schema surface).
- `catalogue.types.ts` (shared/catalogue/ — the engine's first contract)
  + `CatalogueService` (core/marketplace/ — the ONE marketplace HTTP
  choke point the 06a cache lands in).
- `/settings/categories` (ballparkAdminGuard, mirrors the /settings/pages
  table): Name / Tagline / Visibility (Visible|Hidden select) / Sort
  edit-fields save-on-change with optimistic swap + revert-on-failure +
  error line; Items count read-only; inactive rows dimmed.
- Ballpark home gains the **Categories** tile (tags icon → global pick).

## Files touched
| File | Lines (Δ) | SHA | Notes |
|---|---|---|---|
| server/src/routes/marketplace.js | +127 (new) | bb57393 | 3 endpoints |
| server/src/schemas/category-admin.schema.js / .test.js | +18 / +35 (new) | bb57393 | Zod + 5 specs |
| server/src/index.js | +3 | bb57393 | v2 mount |
| client-v2 .../catalogue/catalogue.types.ts | +24 (new) | bb57393 | CategoryInfo + CategoryUpdate |
| client-v2 .../core/marketplace/catalogue.service.ts | +30 (new) | bb57393 | reads + curation write |
| client-v2 .../settings/categories/categories-settings.component.ts | +135 (new) | bb57393 | curation table |
| client-v2 app.routes.ts / launcher-tiles.ts / app.config.ts | +21 | bb57393 | route + tile + icon |
| client-v2 environments/environment.ts | ±1 | bb57393 | chip v2.14a |

## Acceptance (vs the MARKETPLACE.md arc row) — 6 / 6 verified
- Categories backend gated + counted — ✓ live: 15 categories, Florals
  count 13; agency role: browse 200, /all 403, PATCH 403 (authz verified
  in-browser); bad uuid 400; empty patch 400
- Minimal ballpark-admin UI at /settings/categories — ✓ table renders 15
  rows as Beth; route guarded
- Save-on-change persists — ✓ UI tagline edit → DB verified via API →
  reverted to original
- Curation fields only (no hierarchy/images) — ✓ per MARKETPLACE.md
  deferral
- Build + lint + style guard green; client 62/62, server 34/34 — ✓
- v1 untouched — ✓ no client-angular diffs; v1 /api/categories path
  unaffected (different mount)

## API audit checklist
#### `GET /api/marketplace/categories`
- ✓ Method semantics: read-only list
- ✓ Input validation: none needed (no params)
- ✓ Authorization: router-level authenticate + requireActiveMembership
- ✓ Status codes: 200 / 401 / 403 (suspended) — verified
- ✓ Response shape: CategoryInfo[] camelCase
- ✓ Information disclosure: platform-wide catalogue data by design
- ✓ Observability: next(err) → central 5xx logger
- ✓ Idempotency: GET
- ✓ Performance: one GROUP BY over indexed FK; 15 rows
#### `GET /api/marketplace/categories/all`
- ✓ As above + permission gate admin.cross_org_view (403 verified as agency)
#### `PATCH /api/marketplace/categories/:id`
- ✓ Method semantics: partial update
- ✓ Input validation: uuid param check (400) + Zod body (400 + flatten)
- ✓ Authorization: admin.cross_org_view (403 verified as agency)
- ✓ Status codes: 200 / 400 / 401 / 403 / 404 — verified
- ✓ Response shape: fresh CategoryInfo with live count
- ✓ Information disclosure: 404 for absent AND non-catalogue ids alike
- ✓ Observability: next(err)
- N/A Idempotency: same-value PATCH is a harmless no-op write
- ✓ Performance: one UPDATE + one single-row SELECT

## Concerns not in spec
### Curation lacks an audit trail beyond updated_at/updated_by
**Where:** marketplace.js PATCH
**What:** updated_by is populated via the ALS user-context (pool.js SET
LOCAL); no per-field history. Fine for curation; flag if category
changes ever need review.
**Severity:** LOW

### `%ACTIVE%` template substitution in SQL
**Where:** marketplace.js SELECT_CATEGORIES
**What:** the shared projection swaps a placeholder for three FIXED
strings (never user input — parameters stay $n-bound). Idiomatic enough,
but a reviewer should know the substitution values are compile-time
constants only.
**Severity:** LOW

## QC notes
**2026-06-12 (Liam):** "looks good, i update a couple of taglines and
changed sort, works well" — ACCEPTED. Question raised: subcategories not
visible in the table. Answer: by design — 15 top-level rows curated;
~131 subcategories (parent_id set) exist in the data and become
customer-visible via 06a's subcategory strip (?sub= param). DEFERRED:
subcat curation extends this table (same endpoints + ?parent= variant,
indented/drill-down rows) once 06a gives them a visible surface.

## Chat audit
(chat fills this in — leave the section header so chat finds it)
