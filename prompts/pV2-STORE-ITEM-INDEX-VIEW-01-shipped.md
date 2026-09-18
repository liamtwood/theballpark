# pV2-STORE-ITEM-INDEX-VIEW-01 — Surface subcategory + tags on item-edit (read-only)

**Shipped:** 2026-09-18, chip `Dev v2.484` (client only — no server change).
**Owner:** CC. Chat (0d) relayed Liam's greenlight.

## What landed
A read-only **Classification** block on the supplier item-edit screen, under the
Approval panel (existing items only):
- **Subcategory** — `subcategory_name` resolved to a breadcrumb
  "{category} › {subcategory}" (e.g. *Furniture & Fixtures › Seating*); empty
  state **"Not yet classified"** when null.
- **Tags** — the **structured dimension tags** (`item_tags` from the
  `supplier_item_tag` junction), grouped by dimension (colour/material/style/
  setting/…) as read-only `.bp-tag-chip`s; empty state **"No tags"**.
- **Read-only** — no picker, no ✦ Suggest, no persistence (the editable Index-tab
  port is a later slice).

## Files touched
| File | Notes |
|---|---|
| client-v2/.../store/item-edit.component.ts | Classification block + `subcategoryLabel` / `classificationTags` computeds |
| client-v2/.../core/store/store-item.service.ts | `StoreItem` type: added `category_name` / `subcategory_name` / `item_tags` |
| client-v2/src/environments/environment.ts | chip → v2.484 |

## Notes
- **No new endpoint / no server change** — `ItemService.getById` (behind
  `GET /api/store/items/:id`) already returns `category_name` + `subcategory_name`
  and hydrates `item_tags`; the client type simply wasn't carrying them. Now typed
  + rendered.
- Reused existing styling (`.bp-tag-chip`, `.bp-field-label`, `.bp-caption`,
  `.bp-edit-section-title`) — no new components, guard clean.
- The moderator (admin) read (`GET /api/admin/items/:id`) is the same `getById`,
  so the block shows there too. The public `?view` path
  (`/marketplace/items/:id`) may omit `item_tags`; it degrades to the empty
  states (out of scope — this is the supplier/admin edit surface).

## Acceptance
- [x] Item-edit shows subcategory name (+ breadcrumb) and dimension tags as
      read-only chips, near Approval.
- [x] "Not yet classified" / "No tags" empty states.
- [x] No editing, no new endpoint — renders what `getById` already returns.
- [~] Liam QCs (open the Limewash item → Classification: F&F › Seating, tags
      colour Neutral / material Wood / setting Both / style Classic).

## Concerns not in spec
- Dimension labels render raw (`colour`, `event-type`) — lowercase/kebab as
  stored; a title-case polish is trivial if wanted.
- Read-only by design; the editable Index tab (subcat picker + tag chips + ✦
  Suggest) remains the later slice.

## QC notes
(Liam)

## Chat audit
(chat/0d)
