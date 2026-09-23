# pV2-STORE-TAXONOMY-01 — Taxonomy manager (3-level, at /settings/categories) — SHIPPED

**Build:** v2.558 (dev) · **Date:** 2026-09-23 · **Owner:** CC (ballpark-f2)

Replaces the auto-generated, edit-only 2-level categories table at `/settings/categories`
with a proper **taxonomy manager**: a lazy tree of the catalogue hierarchy at **any depth**
(Category ▸ Subcategory ▸ Sub-subcategory), inline-edit + Add / Add-child. Foundation for
classifying items 3 levels deep (Furniture ▸ Seating ▸ Armchairs), which feeds better
project matching. Manual-first (Liam): get 3 levels working by hand here, then the item
classifier, then the extract. See [[project_catalogue_extract_design]].

## Why 3 levels needs no schema change
`items` carries `category_id` + `subcategory_id` (two FKs). A 3rd level works because
`subcategory_id` points to the **deepest** node (Armchairs) whose `parent_id` chain gives the
middle level (Seating) — top + leaf stored, middle derived. `categories.parent_id` already
chains to any depth; the `level` column (Liam added it; was all 0/unmaintained) is now set
correctly on create.

## What shipped
**Server**
- `POST /api/marketplace/categories` (NEW, admin-gated) — create a node: `{ name, parentId? }`.
  `parentId` null → top-level; else a child. `level` derived from the parent chain (ancestor
  count via a recursive CTE) so the column becomes meaningful. `CategoryCreateSchema` added.
- `GET /api/marketplace/categories/all?parent=<id>` already returns any node's children at any
  depth — reused for lazy loading (no change needed).

**Client (client-v2)**
- `core/marketplace/catalogue.service.ts` — `createCategory(name, parentId?)`.
- `pages/settings/categories/categories-settings.component.ts` — rebuilt as the lazy tree:
  per-node expand (lazy-loads children via `adminCategories(id)`), inline edit (name / tagline /
  visibility / sort, save-on-blur, optimistic), **Add category** (header) + **Add child** (＋ per
  row) revealing an inline name input (Enter to add / Esc to cancel) → POST. Indented rows,
  reuses the existing `ed-input` / `app-select` row style. `plus` icon already registered.

## Iteration — v2.559 (manual Classify in the item editor)
The item editor's Classification card is now **editable** (was read-only): when editing, it shows a
cascade under the chosen Category — **Subcategory**, then **Sub-subcategory** (only when the picked
subcategory has children) — and stores the **deepest** pick as `subcategory_id` (`category_id` = the
top). Cascade options load from the public `/categories/:id/subcategories` (active children of any
node). On load it pre-selects the subcategory when it's a direct child; a deeper saved value is
preserved and shown in a "Currently: …" line (no expensive ancestor-chain lookup). Plumbing already
existed end-to-end (`StoreItemWrite.subcategory_id`, `store-item.schema`, item.service update allowlist
v1.41) — this exposed it. So: assign an item to *Folding Chair* by hand. NEXT still open:

## Iteration — v2.560 (tree-aware marketplace browse)
Filtering a subcategory now surfaces items classified to ANY of its descendants — a deeper
classification never hides an item from its parent-level browse. `GET /api/marketplace/items`'s
`sub` filter changed from `subcategory_id = $` to `subcategory_id IN (recursive subtree of $)`;
the subcategory-strip count (`/categories/:id/subcategories`) is likewise subtree-aware so the
rail count matches the grid; `item.service.getAll` (supplier shop / project marketplace) got the
same treatment. Verified: Seating's subtree = {Seating, Folding Chair, Chiavari Chair}, so browsing
Seating rolls up their items. (The drill-down rail still shows one level of subcats; deeper items
roll up into their parent chip.)

## NOT yet (next steps, agreed)
1. ~~Item editor cascading picker~~ — DONE v2.559.
2. ~~Tree-aware browse~~ — DONE v2.560.
2. **Browse/matching tree-aware** — filtering the middle level (Seating) should surface
   grandchildren (Armchairs items); today the filter is 2-level.
3. **Extract** — Prepare auto-creates/assigns the 3rd level (nested Classification, parked).

## QC (platform admin, /settings/categories)
1. Expand a category → its subcategories load; expand a subcategory → its sub-subcategories.
2. **Add category** → name → Enter → new top row; rename/tagline/sort inline.
3. On a subcategory row, **＋ Add child** → name (e.g. "Armchairs") → Enter → lands under it as
   a 3rd level. Confirm it persists on reload.
