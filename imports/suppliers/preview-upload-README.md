# Supplier catalogue upload → preview — transform spec & review notes

**Source:** `Ballpark_Supplier_Upload-5.xlsx` (10 supplier tabs, ~280 items, AI-vendor built).
**Target:** PREVIEW DB (`efqmhtnsxbbgxcfoyftj`). CC writes + runs the loader; this file is the data + the rules.
**Batch tag:** every item carries `attributes._batch = "supplier-upload-2026-11-18"` → the whole load is reversible (yahire-POC pattern).
**Sample in this folder:** `preview-upload-sample-2026-11-18.json` — DCLX (8) + Bravo (8). Smoke-test the envelope before the full 280.
**FULL FILE:** `preview-upload-full-2026-11-18.json` — all 10 suppliers, **288 items** (CC-validated envelope). Flags in `preview-upload-full-2026-11-18-flags.json`.

### Full-file summary (288 items)
| supplier | items | category | notes |
|---|---|---|---|
| DCLX | 8 | AV & Technology | uplights collapsed to 1 `each` + real `price_tiers` |
| Bravo | 8 | Catering | Bronze/Silver/Gold packages, `serves` set |
| Room Service | 7 | Catering | genuine `platter` + serves |
| Drones — TBC | 9 | Photography | day-rate → `time`; B/S/G variants; **delivery flagged** |
| Projection — TBC | 7 | AV & Technology | |
| Florist — TBC | 7 | Florals | brand-launch S/M/L = `package` variants |
| Larkin | 15 | Florals | bundles=`package`; bud vases=`multipack`; arches="from" guide |
| Inchmere | 7 | Logistics & Transport / **Event Accessories (flagged)** | weekly hire=`time/week`, purchase=`each`, bus=POA |
| Juno Hire | 189 | Furniture & Fixtures | S/M/L variant families; chair bundles → per-unit; sets=`multipack` |
| Blue Sky Tipis | 31 | Stand Structure / Lighting / Event Accessories / Furniture | tipis=`package`; sets=`multipack`; decor=`each` |

**Units:** each 240 · package 21 · time 12 · platter 7 · multipack 8.

### Flags (20 — in the -flags.json)
- **10 ×** descriptions still carry vendor meta ("the source…/the brochure…") — flagged **not auto-stripped** (some carry real content, e.g. Garden games' item list). A copy-polish pass is owed on these 10; structure is unaffected.
- **4 ×** Sampling Equipment (Inchmere bins) → placed in **Event Accessories** provisionally — **Liam to confirm** the home.
- **3 ×** Drone **delivery** (Bronze/Silver/Gold) → **Photography vs Logistics, Liam to place**.
- **2 ×** Juno chair bundles collapsed to per-unit `each` (Nord £33.30, Arabella £28.80) — **LINEAR, no discount** → ask supplier for real volume breakpoints.
- **1 ×** Double-decker bus = **POA** (`base_price:null`, `attributes.poa`).

### Known limitations (interim, by design)
- **Colour variants embedded in base names** (e.g. "Mila rust / marine / soft green") are NOT auto-grouped — they load as separate items (colour is before the em-dash, inside the base name). Collapsible later; `_batch` makes it reversible.
- **Cocktail bar** is a 2-D matrix (size × finish): `variant_group.value` carries both ("Small / Black gloss"); finish is same-price (free-pick). Dimension labelled "Size" for simplicity.
- **Images:** none in source — every item loads without an image.

### Three decisions pending (Liam)
1. **Visibility:** load as `approval_status:'pending'` (default) or `approved`+active for the preview demo?
2. **4 "supplier TBC" tabs** (Drones, Projection, Florist): placeholder org, or hold until named?
3. The two taxonomy flags above (Sampling Equipment; drone-delivery).

---

## File shape (agreed with CC against `store-item.schema.js`)

JSON array of supplier blocks:

```
[{ "supplier": { name, city, type:"supplier", description },
   "items": [ <item>, ... ] }]
```

Per-item = `StoreItemCreateSchema` fields. Loader resolves `category` (name → `category_id`) and the org.

| field | notes |
|---|---|
| `name` | variant suffix kept (` — Bronze`, ` — up to 100 guests`) so separate rows stay distinguishable |
| `category` | **taxonomy macro name** (CC resolves; unknowns flagged, not created) — see map below |
| `description` | cleaned: AI meta stripped, redundant "Prices exclude VAT" dropped (VAT is org-level) |
| `base_price` | numeric GBP, **ex-VAT** |
| `unit` | **truthful** free string: `each` / `package` / `multipack` / `per_guest` / `time` / `size` |
| `serves` | int — set ONLY where `ceil(guests/serves)` genuinely applies (per-head packages). NULL for capacity/"up to N" |
| `time_unit` | `day` etc. when `unit=time` |
| `tier` | item_tier string — holds `bronze`/`silver`/`gold` (package levels) or budget…luxury |
| `external_url` | **the SKU** (CC's dedup key) |
| `attributes.dimensions` | `[{label,value}]` — specs: capacity, pack size, measurements |
| `attributes.price_tiers` | `[{min,max,price}]` — real volume breaks only (never fabricated) |
| `attributes.variant_group` | `{group,dimension,value}` — links sibling rows for future collapse |
| `attributes.sku` | original vendor SKU(s), display |
| `attributes._batch` | reversibility tag (above) |

---

## ⚠️ Correction to my first review — NO encoding corruption

My initial review said "currency/dashes mangled, re-export UTF-8." **That was wrong — a display artifact on my Windows terminal, not a defect in the file.** Verified by codepoint: the separators are `U+2014 EM DASH (—)`, quantities use `U+00D7 MULTIPLICATION SIGN (×)`, and `£` is intact. The data is clean UTF-8. **No encoding fix is applied or needed.** Everything else in the review stands.

---

## Transform rules applied

1. **Kill the `platter` catch-all.** The vendor stamped `platter` on everything. Reassigned to the truthful unit: furniture/services/one-off productions → `each`; guest-scaled service packages → `package`; day-rate services → `time`; fixed unit-sets → `multipack`.
2. **`serves` = guests, not capacity.** Where the number was seating/room capacity ("up to 100 guests", "seats 6") it is NOT `serves` (would make `ceil(guests/serves)` misfire) — it goes to `dimensions` as `Capacity`/`Seats`. `serves` is set only on genuinely per-head packages (Bravo drinks: serves 200/12/30).
3. **Variants → separate items + `variant_group`.** The write schema has no first-class priced-variant field, so S/M/L and finish/package variants stay as separate loadable rows, tagged `{group,dimension,value}` so a future variant model can collapse them mechanically.
4. **Bronze/Silver/Gold are PACKAGE tiers, not volume.** Each is its own item with `tier:"gold"` etc. (the item_tier field) + a `variant_group`. They are NOT put in `price_tiers`.
5. **Linear bundles → per-unit; real curves → `price_tiers`.** "N of a thing" bundles become one `each` item. Where the per-unit price actually steps (DCLX uplights: £60→£50→£45 at 12/24/48) that real curve goes into `price_tiers`. Where it's flat (e.g. Juno's Nord chairs at £33.30 throughout) → per-unit base, **no fabricated discount**, flagged "ask supplier for real breakpoints."
6. **Strip AI meta from copy.** "The source lists…", "the brochure shows…", "inferred from…" rewritten to plain customer statements.

---

## Category map (sheet label → taxonomy macro)

| sheet category | → taxonomy macro | confidence |
|---|---|---|
| AV | **AV & Technology** | high (DCLX uplights/control could move to **Lighting** per-item — flagged, not auto-moved) |
| Bars & Drinks | **Catering** (subcat: Bar Service) | high |
| Catering / Street Food & Food Trucks | **Catering** | high |
| Furniture / Furniture & Event Hire | **Furniture & Fixtures** | high |
| Floristry | **Florals** | high |
| Tipis & Structures | **Stand Structure** (subcat: Outdoor & Tensile Structure) | high |
| Projection | **AV & Technology** (subcat: Projection & Mapping) | high |
| Drones (photo/video) | **Photography** (subcat: Drone / Aerial) | medium |
| Decor & Lighting | split per-item: decor → **Event Accessories**/**Furniture & Fixtures**; festoon/disco → **Lighting** | medium — **needs your eye** |
| Vehicles & Logistics | **Logistics & Transport** | medium |
| **Sampling Equipment** (Inchmere bins) | **no clean macro** | **FLAG — Liam to place** (Event Accessories? Logistics?) |
| **Drone delivery** (Inchmere/Drones) | Photography vs Logistics | **FLAG — ambiguous** |

---

## Data gaps (flagged, never invented)

- **`install_cost` = none given.** Big setup jobs (tipi erection, AV rig/crew) have their crew/transport folded into `base_price` by the vendor. Not split out. If you want install as a separate line, the supplier must provide it.
- **No volume discounts** except DCLX uplights. Chairs/benches etc. are linear → per-unit only; `price_tiers` left empty with a flag.
- **POA / "from" prices** (Larkin arches "from £3,000"; Florist "£3,000–£20,000"; Inchmere double-decker bus = no price) → `base_price` holds the floor; the open-ended ones are flagged for a POA/"guide price" flag when that model exists. The bus has `base_price: null` (quote-only).
- **No images** anywhere in the source (`image_url`/`images` empty). Catalogue will look bare until images are added.

---

## Prerequisites for CC before the full load

1. **`item_unit` codelist**: add `package` (or the `platter → package` rename, Liam's call) and **`multipack`** so the editor/`defaultQuantity` treat them right. They LOAD fine as free strings without this, but the app behaviour (label + `ceil(guests/serves)` branching) needs the rows. **Note:** `multipack`'s count is a DESCRIPTOR (`contains N`) — it must NOT drive `ceil(guests/serves)`; keep its count in `dimensions`, leave `serves` null.
2. **Category resolver**: exact-match on `namespace='catalogue'`, excluding `rlstxn%`; flag the two unmapped categories above.
3. **Smoke-test this sample end-to-end on preview**, confirm the envelope, then I generate all 10 tabs to the same shape.
