# pV2-BUILDUP-03 — item options (Final Quote picker) + composition UI shelved

**Shipped:** 2026-08-27, chip `[Dev v2] v2.66`
**Commit:** `<pending>`

Item-level **options** (an item's child items the agent can pick into the Final
Quote), built on the existing recursive line-item model — then, on customer
feedback ("too complicated"), the **entire supplier-facing composition UI
(Customize + Options) was removed from the UI while keeping all the code** for a
later re-enable. Also fixes a component-library leak into the marketplace and
reverts the inbox brief card to the project item.

## What landed

### Item options — pick an item's options into the Final Quote
- A supplier item can carry **options** = child `items` (`parent_item_id` set).
  New public read `GET /api/marketplace/items/:id/options` (agent isn't the
  owner, so the owner-scoped store endpoint returned empty — the bug that
  motivated the public route).
- New **`app-options-picker`**: a simple checklist (checkbox · name · cost · qty)
  off that endpoint. Picking adds each option as a real quote line via
  `addCustomItem`, linked to its parent line.
- New additive column **`project_items.option_of_line_id`** (all 3 schemas,
  recorded in `migrate-schemas.js`): the parent quote line a picked option
  belongs to. Distinct from `parent_id` (the private cost-buildup children,
  excluded from totals) — an option is a **visible, counted, on-PDF** line.
- **Final Quote nests options under their parent line** (indented sub-rows) and
  the right-rail **item card lists them** (`estimate-preview-rail` gained
  `options`/`cur` inputs). Options keep their **own unit** (Wine £15/head, Fridge
  £120/week) — never folded into the parent's rate. Category totals + banner roll
  the options in (they're `parent_id IS NULL`, so already in the cascade).

### Components/options never appear in the marketplace
- `kind='component'` items (the private cost-buildup library) AND any
  `parent_item_id IS NOT NULL` child (options/components) are excluded from:
  the marketplace browse (`/api/marketplace/items`), the single public item
  (`/api/marketplace/items/:id`), and the store list + category counts
  (`item.service.getAll` / `countsByCategory`).
- Data fix: **Carpenter, Metalworker, Seamster** (Ballpark's Supplier) were
  saved as draft items (`kind=NULL`) but are labour components like Woodworker —
  retagged `kind='component'` (migration
  `tag_ballpark_supplier_trade_items_as_components`) so they drop out of the shop.

### Composition UI removed (client: "too complicated") — code kept
- **Removed entry points** (each a commented stub for one-line re-enable):
  - Inbox **Customize** button (header toggle + per-item action) —
    `inbox-project.component.ts`.
  - Final Quote **Options** button (the `list-checks` step icon) —
    `estimate-item-row.component.ts`.
  - Library item **Options & build-up** section — `item-edit.component.ts`.
- **Kept on disk, dormant:** `customize-dialog.component.ts`,
  `options-picker.component.ts`, all endpoints, the nesting/display code. The
  dialog mounts stay in dead template branches (no button to trigger them), so
  imports still resolve and nothing renders.
- **Explore More** on the Final Quote is untouched (kept).

### Inbox brief card → project item (revert)
- The brief attachment + collapsed label now render the **project item**
  (`asPreview` / `line.name`), not the library item (`asRequested` / `libName`).
  The library-vs-project split was part of the shelved negotiation flow.

## Notes / follow-ups
- With the supplier UI gone, new item options must be seeded via DB (as the
  current Dinner/Airstream options were).
- A couple of data-gated bits (inbox "Customizations £X" total, nested option
  sub-rows) are dormant — nothing can create composition data via the UI now.
- `migrate-schemas.js` still carries the pre-existing broken
  `uq_project_items_*` reconciliation to fix before the next preview promote
  (unchanged by this ship).
