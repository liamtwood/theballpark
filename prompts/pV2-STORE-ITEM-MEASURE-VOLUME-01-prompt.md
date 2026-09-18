# pV2-STORE-ITEM-MEASURE-VOLUME-01 — Measurements + Volume pricing on item-edit

**Type:** client-v2 (supplier item-edit) + server (schema + line-total) · editable.
**Owner:** CC implements + commits. Chat authored 2026-09-18.
**Principle (Liam):** build the visible/editable home for these fields BEFORE the
import fills them. Both live in `items.attributes` (JSON), so no new columns.

## Part A — `attributes` write-path (the shared dependency)
`item.service` already persists `attributes` on create/update, but
**`StoreItemCreateSchema` `.strip()`s it** (and `StoreItemUpdateSchema`), so it
never reaches the service. Add **`attributes`** to the Zod schema (an object;
validate shallowly — `dimensions` an array of `{label,value}` strings,
`price_tiers` an array of `{min,max,price}` numbers) so it persists. (NB `serves`/
`time_unit`/`tier` are the *separate* meta.needs write-path slice — not required
here; this slice only needs `attributes`.)

## Part B — Measurements (`attributes.dimensions`)
Editable **freeform label/value list** on item-edit, stored as:
```json
"attributes": { "dimensions": [ {"label":"Height","value":"92 cm"},
                                 {"label":"Weight","value":"3.4 kg"} ] }
```
- **Empty by default.** An **"+ Add measurement"** appends a blank `label | value`
  row. Order preserved (array). Remove per row.
- **`label`** — a text input with **suggestions** (Height · Width · Depth · Weight
  · Seat Height · Volume · Material) offered as a dropdown/autocomplete, but **any
  free text is allowed** (so `Size | 92x39x41` and custom labels both work).
- **`value`** — free text; the **unit lives in the value** ("92 cm", "3.4 kg") —
  no separate unit field.
- **Display** — render the rows as a clean spec block (`Label: value` lines). One
  combined `Size` row or many broken-out rows both render naturally.
- Maps **1:1 to scraped DOM dims** (which are `Height: 92 cm` label/value pairs),
  so the import later writes into this exact structure. No AI slicing in V1.

## Part C — Volume pricing (`attributes.price_tiers`)
Editable **Min / Max / Price grid** on item-edit, stored as:
```json
"attributes": { "price_tiers": [ {"min":1,"max":49,"price":3.39},
                                  {"min":50,"max":99,"price":3.25},
                                  {"min":100,"max":199,"price":2.99},
                                  {"min":200,"max":null,"price":2.85} ] }
```
- Rows of `Min | Max | Price`; add/remove; `max` may be null (the "200+" open top).
- The item **card/detail shows "From £{tier-1 price}"** when tiers exist.
- **No tier picker** — pricing is implicit by quantity (Part D).

## Part D — line-total applies volume by count (implicit)
In `line-total.util.js` (the shared line-total): when the item has
`attributes.price_tiers`, **pick the tier where the line `qty` ∈ [min,max]**
(max null = open top) and use that tier's price instead of `base_price`. No tiers
/ no match → `base_price` (unchanged). This must flow through everywhere line-total
is used (inbox / quote / Customize) so all surfaces agree, same as `flat_total`.

## Acceptance
- [ ] `attributes` persists through create + update (Zod no longer strips it);
      existing item behaviour unchanged when `attributes` absent.
- [ ] Measurements: add/edit/remove freeform `label|value` rows (empty start,
      label suggestions + free text, unit-in-value); renders as a spec block;
      saved to `attributes.dimensions`.
- [ ] Volume: add/edit/remove Min/Max/Price rows → `attributes.price_tiers`; card
      shows "From £{tier1}".
- [ ] line-total picks the tier by qty (60→£3.25, 250→£2.85), falls back to
      base_price with no tiers; consistent across inbox/quote/Customize.
- [ ] No new columns/tables; no AI; reuse existing input/grid/chip styling.

## Notes / not in scope
- Read-only display of these on non-owner surfaces (marketplace/quote) can follow;
  this slice is the supplier-editable home + the pricing behaviour.
- The editable classification (Index tab: subcat picker + tags + Suggest) is a
  separate later slice; INDEX-VIEW-01 already shows classification read-only.
