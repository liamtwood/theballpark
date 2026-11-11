# pV2-BUILDUP-03 — Item cost build-up / estimate — SHIPPED

**Date:** 2026-11-11 · **Branch:** `rebuild/org-slice` → preview

The supplier item editor gains a **cost build-up / estimate**: compose an item's cost
from component lines (grouped by cost-group category), roll it up, and pull the result
into the Ballpark Cost. Revived from the shelved composition UI, rebuilt for item mode.

## What shipped

- **Estimate panel** (shared `customize-dialog` in item mode) opened from a `layers`
  icon on the Cost row. Full-screen, content centred in the `--workspace-max` column.
- **Autosave** — no Save button; edits persist on a ~700 ms debounce and flush on close.
  Item-mode margin is forced 0 and shown as a single built-in **Total** (no margin UI —
  margin is assumed built into the component costs).
- **Component lines**: fractional qty; a hierarchical **Unit** picklist (item_unit +
  time_unit + size as optgroups); category from the **Component** cost-group tree
  (Provisions / Materials / Labor / Transport / Fees …); per-line **image + description**
  edited in a dialog (opened by a pencil icon beside the trash — the old right-rail is gone).
- **`%` lines** — a line's Unit can be **"% of subtotal"**: its cost is read as a
  percentage of the fixed-£ components subtotal (option 1). Qty hidden for % lines.
- **Subtotal above Fees** — project-quote styling (`bp-list-title` + `bp-amount`),
  shown above the Fees cost-group (`total − fees`).
- **Inline estimate on the item** — the Cost row shows **"Estimate £X"**; a `layers-plus`
  icon beside the Ballpark Cost field copies the estimate into the cost (one-shot, NOT a
  live link). The item's base price is deliberately **not** fed into the estimate
  (that inflated it); add-ons come later.
- **Quick View** — standing base price shows unless **priced** variants own the price
  (free-choice dimensions like a menu picker no longer suppress it). The variant picker
  **auto-selects the first value** of each dimension so Quick View opens pre-configured.
- Shared `estimate-total.util.ts` is the ONE definition of the %-aware roll-up, used by
  both the dialog and the item editor (no duplicated math).
- **"Platter" → "Package (serves N)"** unit label (code stays `platter`).

## Key fixes (root causes)

- **Save only persisted the first batch** — the UPDATE path wrote `kind` (`'estimate'`)
  into `items.type`, which only accepts `variant|addon|component` → constraint violation
  rolled back every re-save. Now both INSERT and UPDATE write `type='component'`.
- **First save 23505** — `items_org_name_uidx` spanned the whole table; a component +
  its library clone collide. Scoped it to top-level catalogue items
  (`parent_item_id IS NULL AND type <> 'component'`). (migration 0037)

## Migrations (ride the promote via `run.js`)

- `0036_item_component_quantity.sql` — `items.quantity` (component qty persistence).
- `0037_item_name_uidx_scope.sql` — scope the per-supplier name dedupe index.
- `0038_item_unit_package_label.sql` — relabel `platter` → "Package (serves N)".

## Also in this ship

- **pV2-INVITE-SUPPLIER-01** — "Add outside supplier" dialog (merge invite + first
  request + Save/Send) and the estimate Add-line menu wording. Built earlier; compiles.

## QC

Liam QC'd on localhost :4202 (dev2) — build-up, save, autosave, %, subtotal, inline
estimate + copy, Quick View price + auto-select, menus-as-variants (markdown renders).
Signed off ("qc complete, looks great").
