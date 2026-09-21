# pV2-STORE-ITEM-DELETE-01 — Item delete (supplier + admin) — SHIPPED

**Build:** v2.524 (dev) · **Date:** 2026-09-21 · **Owner:** CC (ballpark-f2) · Requested by Liam via ballpark-d4.

A Delete action on the item editor for the OWNER (own items) and PLATFORM ADMIN (any org's
items via the admin-edit route). Endpoints already existed — mostly UI + a soft-delete cascade.

## What shipped
- **`item-edit-actions.component`** — a red `bp-btn-danger` **Delete** button (right-aligned) in
  the owner-approved and owner/admin draft branches; new `canDelete` + `deleting` inputs +
  `deleteRequested` output. NOT shown on the review (moderator) route or to viewers/agents.
- **`item-edit.component`** — `canDelete = isEdit && !isViewer && !isModerator`; `onDelete()`
  confirms via `confirm.service` ("Delete this item? It'll be removed from the shop…"), then:
  - Owner → `StoreItemService.remove(id)` → `DELETE /api/store/items/:id` (existing).
  - Admin (targetOrgId) → `AdminOrgService.deleteForOrg(orgId, itemId)` → `DELETE /api/admin/orgs/:orgId/items/:itemId` (existing; new client method).
  On success → toast + navigate to the supplier Shop tab (grid refreshes, item gone).
- **`item.service.softDelete`** — now **cascades**: soft-deletes the item's child rows
  (`parent_item_id = id`, e.g. extract-created `kind='option'` children) so they don't orphan.
  Library copies (`parent_item_id IS NULL`) are untouched. Both delete endpoints use softDelete,
  so owner + admin both cascade.
- **Extract dedup already excludes soft-deleted** (`findExisting … WHERE deleted_at IS NULL`), so
  a deleted item can be **re-pulled** from the same URL (Liam's delete-stale-then-repull flow).

No schema change. Client build clean; server load-checked.

## QC
- Supplier: open own item → Delete → confirm → gone from My Shop.
- Admin: supplier Shop → open an item (admin-edit) → Delete → confirm → gone; its options gone too.
- Delete the stale chair (31bb92e1) → re-pull the Yahire URL → creates fresh (not "skipped").
- Agents/review route: no Delete button.
