# pV2-STORE-UNIT-DRIVEN-01 — unit-driven time_unit + size reveals in the item editor

**Shipped:** 2026-11-10 (rebuild/org-slice)
**Commit:** `<sha on push>` (client + one rebuild migration)

## Problem

The v0.2.0 item model is unit-driven: each `item_unit` value carries `meta.needs`, so the editor should reveal the
field that unit needs (platter→serves, time→time_unit, size→size). `serves` was wired, but **time** and **size** had
`needs` set (0011) with **no codelist behind them** — 0007 had retired the old `item_time_unit` list and nothing
replaced it — so selecting unit = Time or Size revealed nothing to pick.

## What landed

- **Migration `0035_unit_driven_codelists.sql`** (idempotent, `NOT EXISTS` guards):
  - `time_unit` codelist (ballpark, family "Item Attributes", default `hour`) — Hour / Half day / Day / Weekend /
    Week / Month — + a `reference_codelist_consumers` row (`items.time_unit`, the existing text column).
  - `size` codelist (default `medium`) — Small / Medium / Large / XLarge. **No consumer row**: size is descriptive
    (prices like `each`), so it lives in `items.attributes.size`, not a dedicated column.
  - Applied to dev2 (`jwerngwvensmmhwrcgul`) and baked here for preview/prod promote.
- **Client reveal** (`item-edit.component.ts`): when `unit = time` → a "Time unit" select (`timeUnitOptions` from
  `/api/codelists/time_unit/values`) patching `time_unit`; when `unit = size` → a "Size" select (`sizeOptions` from
  `/api/codelists/size/values`) writing `attributes.size`. `ItemForm` gains `time_unit` + `size`; hydrate reads
  `item.time_unit` and `attributes.size`; `buildBody` writes `time_unit` (column, null unless unit=time) and
  `attributes.size` (only when unit=size); `size` stripped from the raw-attributes passthrough.
- **Service types** (`store-item.service.ts`): `StoreItemRead` + `StoreItemWrite` gain `time_unit`.

## Data / consistency

- `items.time_unit` column + server support already existed (server `store-item.schema.js` `.passthrough()` carries
  `attributes.size`) — only the client reveal + the two codelists were missing.
- Promote: 0035 ships in the rebuild migration set; verify both codelists exist on preview/prod before relying on
  the reveals (per the codelist-seed grooming checklist).

## Acceptance / QC

- Build — ✓ `ng build` clean (pre-existing bundle-budget warning only).
- Unit = Time reveals the Time-unit picker; Unit = Size reveals the Size picker — ✓ Liam QC (2026-11-10).
