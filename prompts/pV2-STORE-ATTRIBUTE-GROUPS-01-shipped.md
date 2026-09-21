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

## QC
Delete + re-pull the chair → stored `attributes.{measurements,materials,style,features,specifications}`
+ `attributes.options` (7 seat-pad colours, no child rows); editor shows grouped sections + the
options control; empty groups hidden; Measurements populated (not "No dimensions").
