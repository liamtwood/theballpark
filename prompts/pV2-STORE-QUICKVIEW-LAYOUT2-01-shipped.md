# pV2-STORE-QUICKVIEW-LAYOUT2-01 — Quick View layout picker + wide layout 2 (item + supplier)

**Shipped:** 2026-11-10 (rebuild/org-slice)
**Commit:** `<sha on push>` (client + one server projection line)

## Why
Liam wants to demo two Quick View layouts to a customer and ultimately pick one. Layout 1 = the current
single-column view, unchanged. Layout 2 = a wider, two-column presentation that shows the item and the supplier
off far better.

## What landed

### Layout picker
- A `1` / `2` toggle in the dialog header (right of the Item/Supplier switcher). Flipping it is live; the choice
  **persists per-browser** (`localStorage` `bp-qv-layout`) so it sticks while demoing. Dialog width is dynamic —
  780px (layout 1) / 1040px (layout 2).

### Item pane — layout 2 (`quick-view-dialog.component.ts`)
- Two columns: LEFT = name (`--text-2xl`), description, hero image + rounded thumbnail strip (standard card
  radius; click a thumb to swap the hero; a variant pick jumps the hero); RIGHT = the variant configurator + Qty +
  Add (sticky). Qty/Add move out of the footer into the right column.
- Hero image handles mixed sizes: `height:auto` + `max-height:280px` (keeps each image's own ratio, no forced
  letterbox), **no border/fill** so odd sizes blend in. Price shown on the Add button only (removed from the left).
- Header: **supplier logo + name** top-left, Item/Supplier switcher centred, layout toggle right.

### Supplier logo through the projection (`server/src/routes/marketplace.js`, `catalogue.types.ts`)
- Added `supplierLogoUrl` to the marketplace list item projection (`supplier_directory.logo_url` — the view already
  exposed it, no DB/view change). `CatalogueItem.supplierLogoUrl?` consumed by the header (store-icon fallback).

### Supplier pane — layout 2 brand page (`supplier-profile-pane.component.ts`, `wide` input)
- Gated by `[wide]="layout() === 2"` (layout 1 keeps the narrow pane).
- **Banner** cover (height clamped `110–170px`, ≤20vh — never eats the fold) with the logo pulled up to overlap it;
  **logo + name side by side**, city under the name (identity row, `align-items:center`).
- Body two columns: LEFT = website pill + about; RIGHT = **Past projects** as a **two-up vertical shuttle**
  (half-size 3:2 shots in a scrollable grid, `max-height:360px`), each shot showing a **hover title** (the image's
  `label` caption, else the supplier name).
- Collapses to one column under 720px.

## Data / consistency
- No schema change. The one server edit threads an already-present column (`supplier_directory.logo_url`) into the
  list projection + serializer. Everything else is client-only and token-styled.

## Acceptance / QC
- `ng build` clean (pre-existing bundle-budget warning only); `node --check` on the route clean.
- Item layout 2 — ✓ Liam ("awesome, i love it"). Supplier layout 2 brand page — ✓ Liam (2026-11-10).

## Follow-ups
- The layout picker is a demo affordance — once Liam picks a layout, retire the toggle and the unused layout.
- Richer per-project hover titles need captions (`label`) set on the supplier's gallery images.
