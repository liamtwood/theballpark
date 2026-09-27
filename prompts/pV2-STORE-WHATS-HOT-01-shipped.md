# pV2-STORE-WHATS-HOT-01 — Editable Tags + Tier in Classification; shopfront "What's Hot"

**Shipped:** 2026-09-27 (dev)
**Commit:** `d4685117` (single commit, client + server)
**Codelist SQL:** bronze/silver/gold inserted into `shared.reference_codelist_values` (item_tier) via Supabase MCP; seed updated to match.

## What landed

- **Item editor → Classification (item-edit.component.ts):**
  - **Tier** field — a select from the `item_tier` codelist (budget / standard / premium / luxury / aim-for-the-moon + new **bronze / silver / gold**), '—' clears it. Persists to `items.tier`.
  - **Tags** — now EDITABLE (was read-only). Removable chips + a free-text add box + a one-click **🔥 Mark What's Hot** toggle. Writes `items.tags`.
  - The classifier's structured `supplier_item_tag` chips stay, relabelled **Auto tags** (distinct from the free-text tags).
- **Shopfront (supplier-detail.component.ts):**
  - A **🔥 What's Hot** menu link appears FIRST in the store menu band when the store has ≥1 hot item (both single-category and multi-category layouts).
  - The shopfront **defaults to What's Hot** on entry (one-shot per entry; re-armed on tab switch; an explicit pick — All items / a category — sticks and clears the tag).
- **Filter plumbing:** new `?tag=` URL state → MarketplaceStore → `GET /api/marketplace/items?tag=` (server matches `ANY(i.tags)`). `supplierDetail` returns `hotCount` to drive the menu + default.
- **Codelist:** bronze/silver/gold added to `item_tier` — ADDITIVE (existing tiers kept; standard/budget/premium are in use on ~200 items).

## Files touched

| File | Notes |
|---|---|
| server/src/db/codelists-seed.js | item_tier += bronze/silver/gold |
| server/src/schemas/marketplace-query.schema.js | `tag` query param |
| server/src/routes/marketplace.js | `tag` → `ANY(i.tags)` filter |
| server/src/routes/marketplace-suppliers.js | `hotCount` in supplierDetail |
| server/src/schemas/store-item.schema.js | `tier` accepted on write (was stripped) |
| client-v2/.../store/store-item.service.ts | StoreItem/StoreItemWrite += tier |
| client-v2/.../marketplace/catalogue.service.ts | items() passes tag |
| client-v2/.../catalogue/catalogue.types.ts | ItemsQuery.tag, SupplierDetail.hotCount |
| client-v2/.../marketplace/marketplace-store.ts | ?tag state + filterKey + itemsRes + setTagFilter |
| client-v2/.../store/item-edit.component.ts | Tier select + editable Tags editor + What's Hot toggle |
| client-v2/.../suppliers/supplier-detail.component.ts | What's Hot menu link + default-to-hot effect |
| client-v2/src/styles.css | .bp-shopfront-menu__link--hot |

## Acceptance / QC

- Build — ✓ `ng build` clean (pre-existing bundle-budget warnings only).
- Schema parse — ✓ tier/tags accepted on write; tag accepted on query.
- Shopfront (Liam QC 2026-09-27) — ✓ "shows up by default and new menu is first" — PASS.
- Editor Tier + Tags persistence — ⏳ pending Liam QC.

## Notes

- bronze/silver/gold live in the cross-env `shared` codelist table, so they exist for preview/prod too, but are inert there (older code has no tier editor; nothing uses them). Additive/reversible, like a nullable column.
- Reaches preview only on the next promote (dev-only for now).
