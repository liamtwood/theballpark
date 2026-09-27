# pV2-STORE-VARIANTS-EDIT-01 — Multi-dimension variants (options) editor in the item edit UI

**Shipped:** 2026-09-27 (dev)
**Commit:** `<sha on push>` (client-only)

## Problem

Extracted variable products (e.g. "Same Day Flyers London" — `bbb306af…/cac8079f…`) carry a full `attributes.variants` matrix (4 dimensions — Finished Size × Printed Sides × Quantity priced, + Paper Type picker-only — across ~30 combos), but **nothing in the editor rendered it** (only the marketplace quick-view picker did). So multi-level options were invisible and uneditable on the edit page.

## What landed

- New **`ItemVariantsEditorComponent`** (`client-v2/.../store/item-variants-editor.component.ts`):
  - **Dimensions** — per dimension: name + value chips (add/remove) + an **"Affects price"** toggle (so a dimension can be *picker-only*, like Paper Type) + remove. "Add dimension" button.
  - **Combination pricing** — the cartesian product of the price-affecting dimensions, one price per row; existing prices preserved by coordinate; blank rows ignored on save.
  - Emits the whole `VariantMatrix` on change; `null` when no dimensions (so non-variant items keep a clean attributes bag).
- **Wired into item-edit** consistently with the existing Options/Volume editors (Liam: "must be consistent with the existing options"): a **preview card** ("Variants" — lists dimensions + value counts + picker flag + combo count) in the "Volume pricing, Options & Variants" section, plus an **Edit-in-dialog** (`bp-modal`) with Done/Cancel **draft** semantics (seed on open, commit on Done).
- Hydrated from `attributes.variants`; written back through the item's normal save (autosave + explicit). `variants` stripped from the raw-attributes passthrough and re-added explicitly so edits are authoritative.
- Icons `Flame`, `Layers` registered.

## Data / consistency

- Storage unchanged: `items.attributes.variants = { dimensions:[{name,values}], combos:[{values:{dim:val}, price}] }`. Server schema already `.passthrough()`es `attributes`, so no server change.
- Combos keyed by the **pricing** dimensions only; picker-only dimensions are declared in `dimensions` but never in a combo — matching the quick-view picker's read model exactly.

## Acceptance / QC

- Build — ✓ `ng build` clean (pre-existing bundle-budget warnings only).
- Editor shows + edits the flyer's 4-dimension matrix — ⏳ pending Liam QC on :4201.

## Iteration 2 (2026-09-27) — Options retired; variants are the one model

Liam QC'd variants ("great even with 1 option, even the no-cost is great") and decided to **remove flat Options entirely** — variants (incl. a single picker-only dimension) cover every case. No migration: the 60 dev items with options were test data (soft-deleted), the 1 preview item was deleted, and prod (master) was never deployed (0 items, still v1 shape).

- **Import** (`catalogue-extract.service.js`): extracted selectable choices now become a **single-dimension variant** (`dimensions:[{name:'Option', values:[…]}]`) instead of `attributes.options`. Free picks (all £0) → picker-only (no combos); upcharges → absolute combo prices (base + delta). Skipped if the item already has a variant matrix.
- **Editor** (`item-edit.component.ts`): removed the Options preview card, dialog, `optionsRows`/`optionsDraft` state + handlers, hydration and buildBody write. `options` still stripped from the raw-attributes passthrough so any legacy key is dropped on save.
- **Read surface** (`item-attribute-cards.component.ts`): removed the "Choose your option" `<select>` (+ FormsModule); the variant picker owns choice/price on the surfaces that have it.
- The separate BUILDUP child-item options picker (`project-estimate` / `options-picker`) is unrelated and untouched.

## Notes / follow-ups

- base_price vs matrix: the item's `base_price` (quick-view "From £…") still comes from the cheapest combo at read time; not recomputed on edit here.
- Ties into the image → option tagging design (pV2 image `optionTags: [{dim,value}]`) — the same dimension/value vocabulary the picker will tag against.
