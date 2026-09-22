# pV2-STORE-ITEM-EDIT-LAYOUT-01 — Edit-page layout + card affordance refinements

**Type:** client-v2 · UI polish on the item EDIT page. **Owner:** CC implements + commits.
**From:** Liam QC 2026-09-22, after the view/edit build (v2.532). Itemized below.

## Layout (item edit page)
1. **Gallery** — main image on the LEFT, gallery images as a **vertical column to the RIGHT**
   of the main image (not stacked below it).
2. **Description** — below the image row.
3. **New "Cost" container** (a card, 2-column grid):
   - Row 1: **Ballpark Cost (£)** | **Unit** (base_price | unit)
   - Row 2: **Location** | **Lead Time** (location_coverage/coverage_area | lead_time_days)
4. **New "Installation" container** (a 2nd card):
   - Row: **Install Cost (£)** | **Unit** (install_cost | install_unit)
   - **Included services** (install_description) — full width below.
5. **Measurements** — add an ICON to the heading (ruler icon, like the other group cards).

## Card affordances
6. **Add affordance** — in the containers that have an "add" (the attribute group cards):
   REMOVE the "+ Add Row" / "Add <group>" button. Instead put a simple **"+" icon with NO
   background** in the **top-right corner** of the container. Keep the per-row remove (trash).
7. **Value column white bg** — the 2nd column (the value field, e.g. "92 cm") gets a **white
   background** (currently gray/surface). The label column (1st) stays as-is.

## Notes
- Edit page keeps mirroring the view's card language (quick-view-dialog styling); this just
  reorganises the CORE fields into the "Cost" + "Installation" containers and tidies the add
  affordance + value-field background.
- No data/model change — layout + styling only.

## Acceptance
- [ ] Gallery renders to the right of the main image (vertical), description below.
- [ ] "Cost" container: Ballpark Cost | Unit, then Location | Lead Time (2-col).
- [ ] "Installation" container: Install Cost | Unit, then Included services (full width).
- [ ] Measurements heading has an icon.
- [ ] Add-containers show a top-right "+" (no background), not an Add-Row button; per-row remove stays.
- [ ] Value column (2nd) has a white background.
- [ ] Build clean; push dev; shipped note.
