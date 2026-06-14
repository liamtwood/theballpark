# pV2-QUANTITY-01 — units consolidation + item quantity feature

**Shipped:** 2026-06-14, chips server (no client chip) + `[Dev v2] v2.26a`
**Commits:** `c25dc45f` (server: consolidation migration + quantity + smart-fill + PATCH), `9310018e` (client: qty input UI + qty-weighted totals)

## Phase 0 — audit (reported, single-list call taken by Liam)
- Units are codelist-driven: `item_unit` (→ `items.unit`, default `each`) + `item_time_unit` (→ `items.time_unit`, default `day`), v1-inherited live data.
- **Key finding:** `item_time_unit` was dead (150/152 NULL) and its codes (`event` 41, `day` 25) had leaked into `items.unit`. Smart-fill ceiling is ~22% (only `head`+`day` map to project fields).
- Liam's call: **(C) single-list model**, defer multi-dimensional (unit×time) units, no code renames. Spot-check skipped at his instruction.

## What landed

### Phase 1 — units consolidation (single-list)
- Folded `day`/`event`/`hour` into `item_unit`; **retired the `item_time_unit` parent** (`is_active=false`, values left intact — never DROP).
- Merged the countable long tail (`unit/cover/package/set/item/pair/panel/platter/letter/load/pallet/cbm/linear_m/sqft/table`) → `each`; `project` → `event`. Deactivated the merged-away values.
- Keeper set: **Head / Day / Event / Hour / Each / m²** (clean sort order). `items.unit` re-pointed across public/preview/master + NULL→`each`. **Verified: 0 items on inactive/unknown units.**

### Phase 2 — schema + backend
- `project_items.quantity` normalised to **INT NOT NULL DEFAULT 1** (a v1-era `numeric NULL` column pre-existed; backfilled NULL/<1 → 1, then typed + constrained). 0 rows with NULL/<1.
- `shared.reference_codelist_values.auto_fill_field TEXT` (nullable); seeded `head→guest_count`, `day→duration_days`.
- `PATCH /api/projects-v2/:id/items/:itemId { quantity }` — Zod positive integer; `updateItemQuantity` service method.
- GET items + add/patch all return `quantity`.

### Phase 4 — smart auto-fill
- `addItem` seeds the default qty from the item's unit → `auto_fill_field` → project field (`guest_count`/`duration_days`, ≥1, else 1). User overrides via the input.

### Phase 3 + 5 — UI + qty-weighted math
- New `<app-qty-input>` (commit on **blur AND Enter**, integer ≥1, reverts on invalid), `.bp-qty-input` role class (compact, right-aligned, native spinner suppressed).
- Wired into the **Project Quote rail** + the **Estimate accordion** item rows; optimistic update, revert + toast on error.
- Rail subtotal, the estimate cascade (Subtotal→Contingency→Your cost→Margin→VAT→Client total), and category-card totals are all qty-weighted via `lineCost` = `basePrice × quantity`.
- **Item card unchanged** (v2.20q) — qty is a cart/quote concern; the `+` stays a toggle.

## Files touched

| File | SHA | Notes |
|---|---|---|
| server/src/db/migrate-schemas.js | c25dc45f | QUANTITY-01 block — quantity INT NOT NULL, auto_fill_field, single-list consolidation + items.unit re-point (3 schemas) |
| server/src/services/projects.service.js | c25dc45f | defaultQuantity (smart-fill) in addItem; updateItemQuantity |
| server/src/routes/projects-v2.js | c25dc45f | PATCH /:id/items/:itemId (Zod positive int) |
| client-v2/.../core/projects/project.service.ts | 9310018e | setQuoteItemQuantity (PATCH) |
| client-v2/.../pages/projects/qty-input.component.ts | 9310018e | NEW — controlled qty field, commit on blur+Enter |
| client-v2/.../pages/projects/project-quote-rail.component.ts | 9310018e | qty input per line + qtyChanged output (subtotal already qty-weighted) |
| client-v2/.../pages/projects/project-marketplace.component.ts | 9310018e | onQtyChange — optimistic, revert+toast |
| client-v2/.../pages/projects/project-estimate.component.ts | 9310018e | rows→writable signal, qty input in item rows, onQtyChange |
| client-v2/src/styles.css | 9310018e | .bp-qty-input role class |
| docs/CODELISTS.md | (docs) | single-list model + multi-dim deferral note; item_unit/item_time_unit rows |

## Acceptance — Done definition

- Audit reported, units consolidated, schema migrated, PATCH smoke-green — ✓
- Type 150 on a per-head item → cart line, quote line, AND cascade all reflect 150 × price — ✓ (qty-weighted lineCost drives all three; smoke confirmed add/patch/GET)
- per_head item + guest_count=150 → defaults 150; no guest_count → defaults 1 — ✓ (smoke: head=150 / day=3 / each=1 / no-guest=1)
- Build + lint + 67 tests green; no item-card change; `.bp-qty-input` in styles.css — ✓
- PATCH validation (0, 1.5 → 400) — ✓ smoke
- Server 48/48 — ✓

## API audit checklist

#### `PATCH /api/projects-v2/:id/items/:itemId` (new)
- ✓ Method semantics (partial update of one field) / ✓ Input validation (Zod `quantity: int positive`) / ✓ Authorization: v2 gate (authenticate + requireActiveMembership) / ✓ **org_id from JWT only** / ✓ Status codes (200; 400 invalid; 404 project-not-org's OR item-not-in-quote) / ✓ Response shape (the updated QuoteLine) / ✓ Information disclosure: org-scoped ownership check before update / ✓ Observability: errors via next() / ✓ Idempotency: PATCH to the same qty is a no-op / ✓ Performance: single ownership SELECT + single UPDATE

## Concerns not in spec

### Smart-fill coverage is inherently ~22%
**Where:** auto_fill_field seed (head/day only).
**What:** Only `guest_count` + `duration_days` exist as project fields to fill from, so only `head`/`day` items get a non-trivial default; everything else defaults to 1. This is the data ceiling, not a bug — forcing more mappings would misclassify items.
**Severity:** LOW (documented; a 3rd field like project area is a future option).

### `create` response omits guestCount/durationDays
**Where:** projects.service create() return shape.
**What:** The POST /projects-v2 response didn't echo guestCount/durationDays (the smoke showed `undefined`), though the DB stored them correctly (smart-fill read 150/3 back). Detail GET includes them; only the create response is thin. Pre-existing, not introduced here.
**Severity:** LOW.

### Multi-dimensional units deferred (Liam's call)
**Where:** units model.
**What:** unit × time (rooms × nights) is not modelled — single quantity + single unit only. Documented in CODELISTS.md with the path back. Deferred per Liam 2026-06-14.
**Severity:** LOW (explicit deferral).

## QC notes
(Liam fills this in)

## Chat audit
(chat fills this in — leave the section header so chat finds it)
