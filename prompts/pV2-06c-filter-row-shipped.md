# pV2-06c — Marketplace filter row (price / tier / supplier)

**Shipped:** 2026-06-12, chips `[Dev v2] v2.14f` (RP-05 fix, `c11dfc3`) + `[Dev v2] v2.14g` (filters, `89b27e1`)
**Spec:** `docs/MARKETPLACE.md` (arc row pV2-06c) + `prompts/pV2-06-angular-architecture.md`

## Pre-ship data finding (the flagged "gnarliest piece")
`items.attributes` is **empty across the entire catalogue** (0 of 144
items) — v1's category-specific dimension filters (sidebar GROUP 2) have
no data behind them at all. The three dimensions WITH real data ship
instead: **price** (£5–£14k, median £500 → 4 brackets), **tier**
(basic 17 / mid 107 / premium 16), **supplier** (12 with active items).
Category-specific attribute filters stay DEFERRED until supplier item
editing (the /store arc) creates attribute data.

## What landed
### v2.14f — RP-05 closed by prevention (pre-ship, per chat's audit)
All 8 marketplace-arc component-local `.bp-*` definitions moved to
styles.css §Marketplace utilities (viewtoggle ×2, catstrip ×2,
item-card/preview imagery ×4, rail-empty); `check-style-guards.js` now
FAILS any `.bp-*` selector definition inside component .ts files
(plant-fail-revert drilled). Legacy BEM-element files ratchet-allowlisted
(edit-field, home-launcher, launcher-tile, page-hero — shrink-only).
AUDIT_LEDGER RP-05 → CLOSED BY PREVENTION. Zero visual change.

### v2.14g — the filters
- **Server**: `ItemsQuerySchema` + `priceMin`/`priceMax` (bounded
  numbers), `tier` (enum), `supplier` (uuid) — all reaching SQL as bound
  params; new `GET /api/marketplace/suppliers/options` (id / name /
  active-item count) for the dropdown.
- **Client**: `PRICE_BRACKETS` (stable URL keys, relabel-safe), `asTier`
  guard, `SupplierOption`; store gains `?price`/`?tier`/`?sup` computeds
  folded into the filterKey (offset + accumulation auto-reset),
  writers + `clearFilters()`; cached `supplierOptions()` read.
- **UI**: three edit-field selects (Any-sentinel) + a "Clear filters"
  link in the search row. Layout per MARKETPLACE.md ("search bar +
  filter chips" band — selects, not v1's sidebar).

## Files touched
| File | SHA | Notes |
|---|---|---|
| client-v2 styles.css + scripts/check-style-guards.js + 5 components + docs/AUDIT_LEDGER.md | c11dfc3 | RP-05 sweep + guard |
| server marketplace-query.schema.js + marketplace.js | 89b27e1 | filter params + options endpoint |
| client-v2 catalogue.types/.service, marketplace-store/-page, environment | 89b27e1 | brackets/guards/store/UI; chip v2.14g (v2.14f env bump folded — noted) |

## Acceptance — 7 / 7 verified live on 4201
- Three selects render in the search row — ✓
- `?tier=premium` → 16 items (matches the DB tier count exactly) — ✓
- `?price=gt2000` → 33 items — ✓
- Supplier filter total === the option's item count (Construct & Co.
  London, 10) — ✓
- Clear filters → 48 cards, clean URL — ✓
- Filter change resets pagination (filterKey → offset 0) — ✓ by
  construction (linkedSignal) + observed page-0 replace
- Guard drill: planted `.bp-drill-violation` failed the build; revert
  clean — ✓; build/lint/guard green, 64/64 + 39/39 — ✓

## API audit checklist
#### `GET /api/marketplace/suppliers/options`
- ✓ Method semantics: read-only list
- ✓ Input validation: none needed (no params)
- ✓ Authorization: router-level authenticate + requireActiveMembership
- ✓ Status codes: 200 / 401 / 403
- ✓ Response shape: [{id, name, count}] camelCase
- ✓ Information disclosure: supplier names are marketplace-public by design
- ✓ Observability: next(err)
- ✓ Idempotency: GET
- ✓ Performance: one GROUP BY join over indexed FK
#### `GET /api/marketplace/items` (params extended)
- ✓ All v2.14b checklist items hold; new params Zod-bounded + $n-bound

## Concerns not in spec
### Tier vocabulary hardcoded client-side
**Where:** tierOptions in marketplace-page + Zod enum
**What:** basic/mid/premium is duplicated client + server (enum) — fine
while the tier set is static; if tiers ever become data-driven, both move
to a codelist.
**Severity:** LOW

### 4 items have NULL tier
**Where:** data
**What:** tier filters exclude them by definition (no "untiered" option).
Cosmetic until someone asks where their item went.
**Severity:** LOW

## QC notes
**2026-06-12 (Liam):** "tested the filters, all worked... searched rocket
food in venue (none as expect) then catering and it showed (13) and 13
were displayed all rocket food. QC good" — ACCEPTED, incl. combined
supplier×category filtering with counts matching the displayed grid.

## Chat audit
(chat fills this in — leave the section header so chat finds it)
