# pV2-STORE-ITEM-EDIT-LAYOUT-01 — Edit-page layout + card affordance refinements — SHIPPED

**Build:** v2.533 (dev) · **Date:** 2026-09-22 · **Owner:** CC (ballpark-f2) · Liam QC (confirmed
directly + matches the designer spec). Layout/styling only — no data/model change.

## What shipped (item-edit page)
1. **Gallery** — main image LEFT + gallery images as a vertical column to the RIGHT (2-col grid
   `sm:grid-cols-[1.6fr_1fr]`, stacks on narrow), not below.
2. **Description** — moved below the image row.
3. **"Cost" container** (bp-qv-spec card, 2-col): Ballpark Cost (£) | Unit ; Location | Lead Time
   (base_price | unit ; location_coverage | lead_time_days).
4. **"Installation" container** (bp-qv-spec card): Install Cost (£) | Unit (install_cost |
   install_unit) ; Included services (install_description) full width.
5. **Measurements** heading has the ruler icon (via GROUP_DEF `icon` — already present; confirmed).
6. **Add affordance** — the attribute-group cards drop the "+ Add row" button; a plain top-right
   "+" icon (no background) adds a row instead. Per-row remove (trash) kept.
7. **Value column white** — the group row's 2nd input (value, e.g. "92 cm") gets
   `background: var(--color-surface)` (#fff); the label input stays `--color-fill` (gray).

Card language unchanged (quick-view-dialog `.bp-qv-spec`). Client-only; build clean.

## QC
Edit an item → gallery renders right of the main image; description below; Cost + Installation
containers (2-col); Measurements has the ruler icon; group cards show a top-right "+" (no bg), no
Add-row button, trash per row; the value field has a white background.

## QC iteration — v2.534 (blank edit page fix)
Item-edit page rendered blank below Installation (empty group cards, missing Cost/Installation fields).
Root cause: this arc introduced lucide icons `ruler` (Measurements) + `pencil` (Edit buttons) that
were NOT in the registered LucideAngularModule.pick set. lucide-angular v0.577 THROWS on an
unregistered icon (ngOnChanges: "The \"ruler\" icon has not been provided…"), and in zoneless
Angular that abort blanked the rest of the render. Fix: registered Ruler + Pencil in app.config.ts.
