# BE-00104 — Marketplace is read-only all around (card click → view dialog)

**Shipped:** 2026-09-19, chip `Dev v2.486`, commit `1ba600bb`. **Owner:** CC (f2).

**Not a regression (Liam 2026-09-19):** the prior behaviour was sensible —
owned → edit, not-owned → view. Liam's call is the deliberate product change:
the marketplace/browse surface should be read-only for *everyone*, owner
included ("it makes it better all around"). Editing moves to the explicit owner
pencil only. Kept under BE-00104 per ballpark-11's ticket + audit class.

Logged by ballpark-11 as BE-00104 (Bug, P1). Rule (ballpark-11): *a
marketplace/browse surface must route an item to the read-only view dialog,
never the edit screen; edit is owner-in-store only, and the gate is
server-authoritative.* WORKING_STANDARDS.md §8 "Mutating affordance in a
read-only context" added as a standing audit class.

## Root cause
`item-card.open()` (the card **host** click) routed **owned** items straight to
`/store/items/:id` (editor) on every surface. The `!owned` guard added in v2.459
only sent *non-owner* clicks to Quick View; an owner's own card still opened the
editor. This was invisible until the owner's items became approved+active and so
appeared in the **global marketplace browse** (Liam's recent QC: "on active show
in marketplace") — from then a body click on your own marketplace item opened
the full editor (now with the new Dimensions/Volume editors), which is the
regression Liam saw.

Card (grid) view was also the *lone* surface doing this: **list** and **table**
view already emitted `entitySelected → openQuickView` for **every** row, owner
included. So the fix also removes a card-vs-list inconsistency.

## Fix (client, one lever)
`client-v2/.../shared/catalogue/item-card.component.ts` — `open()`: when
`showQuickView()` is set (every browse surface: marketplace-page,
project-marketplace, supplier shopfront), a body click **always** emits
`quickView` → the read-only Quick View dialog, owner included. Editing is reached
only via the explicit **Edit pencil** on the owner's own card (owner-only,
`ownedByActiveOrg`). The `!showQuickView()` branch (no browse surface uses it
today) still falls back to the read-only item page (`?view=1`) for non-owners.

## Server gate (already in place — verified, no change)
- `GET /api/store/items/:id` and `PUT /api/store/items/:id` reject a foreign item
  with 404 (`store-items.js` — `item.org_id !== req.user.org_id`).
- The public read path (`GET /api/marketplace/items/:id`) is approved+active only.
- `ownedByActiveOrg` is server-derived (`marketplace.js` — `i.org_id = $1`,
  `$1 = req.user.org_id`), never from the client.
So a non-owner cannot read or write the edit surface even by hand-typing the URL;
the client change is the read-only-context half of the rule.

## Acceptance
- [x] Card click on marketplace / project-marketplace / supplier shopfront opens
      Quick View for every item, owner included.
- [x] Owner still edits via the Edit pencil on their own card.
- [x] Card, list, and table views now behave identically on click.
- [x] Non-owner edit read/write already 404s server-side (verified, unchanged).
- [x] Build clean; guard clean (only pre-existing index.html @font-face warnings).
- [~] Liam QCs on localhost.

## QC notes
(Liam)
