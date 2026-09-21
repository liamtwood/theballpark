# pV2-STORE-ATTRIBUTE-GROUPS-01 — Canonical attribute groups + options — SHIPPED

**Build:** v2.528 (dev) · **Date:** 2026-09-21 · **Owner:** CC (ballpark-f2) · via ballpark-d4.
**Model:** describe with `{label,value}` groups; choose-and-price with `{name,price}` options.

## Part 1 — DATA (extract → groups)
- `ai.service` PULL_SYSTEM now returns `attributes` as the 5 canonical groups —
  `specifications` / `features` / `style` / `measurements` / `materials`, each `[{label,value}]`
  (measurements include the unit in the value) — plus `options` as `[{name, price}]` (additive delta).
- `catalogue-extract`: new `routeAttributes()` normalises the AI's grouped output (and, as a
  fallback, heuristically routes a flat bag into the 5 groups). Writes only the non-empty groups +
  `attributes.options` + `price_tiers` + `_source`. **`toDimensions()` removed**; **the option
  child-item loop removed** — options live on the parent item, no `kind='option'` rows.

## Part 2 — VIEW (grouped read-only display + options)
On the item editor's read surface (the item view — where the full item + attributes load; Liam
reviews pulled items here via the admin item-edit route):
- Each **populated** group renders as a section (heading + `label:value` rows) in fixed order
  (Specifications, Features, Style, [Measurements = the editable section], Materials); **empty
  groups render nothing**.
- An **Options · Select one** control appears **only when `attributes.options` is populated** —
  lists each name + its `+£delta` (or "Included"). Selecting → line-price via the SSOT is a
  noted follow-up (v1 displays only).

## Part 3 — EDITOR (align the reader)
- The editor's Measurements section now reads **`attributes.measurements`** (aliasing the legacy
  `attributes.dimensions` for pre-migration items) and **writes `measurements`** on save, dropping
  the legacy `dimensions` key. The other groups + options + `_source` ride through untouched
  (`strippedRawAttributes`) — grouped data is never lost. (Editable sections for the other 4 groups
  are a fast-follow; they display read-only for now.)

## Reserved (NOT built)
`attributes.variants` (per-combination matrix) + child-item components; admin-managed codelist of
groups (groups are hardcoded — the fixed 5 + options).

## Follow-ups / notes
- Options selection → line-price SSOT wiring.
- Editable UI for Specifications/Features/Style/Materials.
- "Conditional everywhere incl. install / no empty rows" is delivered for the grouped sections +
  options (empty hidden). The item editor's core/install fields stay field-style (they're the
  editor); a pure read-only item view (e.g. quick-view, which needs attributes added to the list
  projection) would apply conditional-install end-to-end — flagged to d4.

## QC iteration — v2.530 (grouped cards → quick-view)
- Extracted a shared `ItemAttributeCardsComponent` (used by item-edit view AND the marketplace
  quick-view — one definition). Renders the Options "Choose your option" picklist (KEY, always
  visible when present) + a "Show more details" drill revealing one rounded card per POPULATED
  group (Measurements/Materials/Style/Features/Specifications), each with a lucide icon, using the
  quick-view `.bp-qv-spec` box style — promoted to GLOBAL styles.css so both surfaces share it.
- Marketplace **list projection now carries `attributes`** (`i.attributes` + `CatalogueItem.attributes`)
  so the quick-view (rendered from the loaded list row) has the grouped data.
- Quick-view: replaced ALL "Coming soon" placeholders with real data — KEY Volume-pricing card
  (guide tiers) + Included-services (only if present) + the shared Options picklist + Show-more
  spec cards. Empty/absent → nothing renders.
- Flags to d4 (awaiting decisions, NOT changed): (a) price format — quick-view shows "From £4"
  (currency '1.0-0' rounds £3.75→£4); confirm £3.75 vs £4. (b) qty stepper on the quick-view —
  touches the `add` contract (currently emits id only); follow-up. (c) image — the re-pulled chair
  has `image_url = null` (this pull's AI returned no images — extraction reliability, NOT a
  projection bug; coverUrl=image_url is correct).
- NEXT (scoped, not built — design still converging): EDIT PAGE mirrors the view's card layout;
  options + tiered pricing add/edit via Ballpark DIALOGS (replacing inline editable boxes).

## QC iteration — v2.529 (Liam QC on v2.528)
1. **Editor — all 5 groups editable**: Specifications / Features / Style / Measurements / Materials
   each render as editable label/value rows (same formatting: label box + value box + trash + "Add
   <group>"), generic `groupRows` signal + `addRow/removeRow/patchRow`; each saves to
   `attributes.<key> = [{label,value}]` (legacy `dimensions` dropped; options/_source/price_tiers
   preserved). Measurements' first Add still seeds H/W/D/Weight.
2. **View — rounded cards**: each populated group renders as a rounded bordered card (heading +
   label:value rows) in fixed order; empty groups hidden. Replaces the plain-text sections + the
   "Coming soon" placeholders with real grouped data.
3. **View — options picklist**: options render as a "Select one" `<select>` (name + `(+£delta)` /
   `(Included)`); display-only (SSOT price wiring still the follow-up).
4. **Layout fix**: the hero + "Edit Product" header + form now share the `--workspace-max` column
   (hero `align="block"` + `bp-page-body--workspace`, dropped the mismatched `max-w-4xl`) so their
   left edges line up (project_workspace_layout_reference).
Note: rounded-card VIEW lives on the item editor's view surface (full attributes load there). The
marketplace quick-view still uses the list projection — extending it needs attributes on that
projection+SQL (flagged to d4, awaiting which-surface confirmation).

## QC (v2.528)
Delete + re-pull the chair → stored `attributes.{measurements,materials,style,features,specifications}`
+ `attributes.options` (7 seat-pad colours, no child rows); editor shows grouped sections + the
options control; empty groups hidden; Measurements populated (not "No dimensions").
