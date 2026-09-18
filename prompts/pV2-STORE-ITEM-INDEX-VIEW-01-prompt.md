# pV2-STORE-ITEM-INDEX-VIEW-01 — Surface subcategory + tags on item-edit (read-only)

**Type:** client-v2 (supplier item-edit) · small UI add · **read-only for now.**
**Owner:** CC. Chat authored 2026-09-18.

## Goal
Make the **auto-classification visible.** Today the classifier derives
`subcategory` + tags on create silently (no UI), so a supplier can't see what was
assigned. Surface the item's **subcategory** and **tag values** on the item-edit
screen, near the **Approval** section, **READ-ONLY** — no picker/editing yet.

## Why read-only now
Editing classification (subcat picker + tag chips + ✦ Suggest) is the fuller v1
**Index-tab port** — a later slice. This one just *shows* the derived values so
the supplier/admin can see the classification while it's still implicit. Display
before edit (Liam's principle).

## What to show
- **Subcategory** — the item's `subcategory_id` resolved to its name (and, if
  cheap, the derived breadcrumb Furniture & Fixtures › Seating). Empty state:
  "Not yet classified" when `subcategory_id` is null.
- **Tags** — the **structured dimension tags** (the `supplier_item_tag` junction,
  already hydrated as `item_tags` on `getById` — grouped by dimension:
  colour/material/style/setting/etc.), rendered as read-only chips. NOT the
  free-text `items.tags` array. Empty state: "No tags".

## Notes
- **Data already exists on read** — `item.service.getById` returns
  `subcategory_name` + `item_tags` (dimension/label). No new endpoint; just render
  them. Confirm the item-edit screen's read includes these (it may use a
  store-specific fetch — wire the fields through if missing).
- **Placement**: near/under the Approval section on item-edit, as a small
  read-only "Classification" block (subcategory + grouped tag chips).
- **Read-only**: no inputs, no Suggest button, no persistence — purely display.
  (The editable Index tab + Suggest is the later slice.)
- Reuse existing chip/label styling; don't invent components.

## Acceptance
- [ ] Item-edit shows the item's subcategory name (+ breadcrumb if easy) and its
      dimension tags as read-only chips, near Approval.
- [ ] "Not yet classified" / "No tags" empty states when unset.
- [ ] No editing, no new endpoint — reads what `getById` already returns.
