# pV2-STORE-IMPORT-01 — Item Load & Profiles (v0.2.0)

**Type:** server + client-v2 · the item-onboarding arc
**Owner:** CC implements + commits. Chat authored this. Tracker:
**FR-00202** (load) · **FR-00204** (foundations) · **FR-00208** (unit-driven fields),
all under Items/Taxonomy epics. Target **v0.2.0**.
**Design docs:** `docs/item-import-one-pager.html`, `docs/item-attributes-one-pager.html`,
`docs/item-taxonomy-arc-roadmap.md`.

One merged workstream (foundations are just seeding, so not a separate phase).
Build in the order below; each part is shippable on its own.

## Guiding principles (hold throughout)
- **Codelists for every flat vocabulary.** Reuse the existing engine
  (`reference_codelists` + `reference_codelist_values` + `codelist.service.js`) —
  do NOT invent a parallel one. Tier, mood, unit, time_unit are all codelists.
- **No profiles, no `item_type`.** Every item shares ONE universal core; the
  chosen **`unit`** is the single selector that adds *at most one* conditional
  field, via `item_unit.meta.needs`. Category is NOT the decider.
- **code = canonical / label = flexible.** Logic, matching and storage key off
  `code`; the display is `label` and can be relabelled freely (statuses already
  work this way; Jira-style). Synonyms collapse to one code + a chosen label —
  which is also the anti-proliferation firewall.
- **No AI in V1.** Subcategory is *picked*; tags/tier come from the codelist +
  the review grid. The classifier (Phase 2) is out of scope here.
- **org_id is sacred** — from the created supplier org / JWT, never the file.
- **Controlled extension only** — new vocabulary enters only via the
  human-gated "should we add?" gate (a new `reference_codelist_values` row, or a
  new tag/subcat via its table). Nothing auto-mints.

---

## Part A — Foundations (seed + write-path)
1. **Seed codelists** via `codelists-seed.js` (`reference_codelists` +
   `_values`):
   - **`item_tier`** (NEW codelist, consumes `items.tier`) — ordered: Budget ·
     Standard · Premium · Luxury · Aim for the Moon (by `sort_order`). Backfill
     `items.tier`: `basic→Budget`, `mid→Standard`, `premium→Premium`; leave
     nulls. NB distinct from the existing **`budget_tier`** codelist, which is the
     *project* tier (`projects.tier`: starter/professional/premium) — don't touch
     that.
   - **`item_unit` / `item_time_unit`** are already codelists — **reuse**, but
     **prune `item_unit` hard to 5** (more choice = more work for suppliers,
     importers and the review grid): **each · per guest · platter · time · size**
     (code `per_guest`, label "Per Guest" — the old `head`/`cover` relabelled).
     Each generic unit absorbs its synonyms (`each` ← unit/item/pair/set/package/
     pallet/panel/letter/load; `per_guest` ← head/cover; `platter` ← table;
     **`time` ← day/hour/event/half_day/month** — the granularity moves to
     `item_time_unit`; **`size` ← sqm/sqft/linear_m/cbm** — all measured units
     collapse to one). Deactivate the rest (`is_active=false`, keep rows for
     history) and **re-point existing items** onto the kept unit. Add
     **`meta.needs`** to the 5 kept values (appendix).
   - **`mood`** — Relaxed · Celebratory · Impressive · Sophisticated · Intimate
     (hidden in UI for now; classifier-fed later).
   - **`item_attribute`** — holds the structured extras that land in
     `items.attributes`; each value carries `meta { value_type:
     number|char|description|list, unit?, filterable? }`. V1 needs exactly one:
     **`size`** (`value_type: char` — a free-text **label**: "Small",
     "23x6x18", "50 sqm". Descriptive only; it does NOT drive quantity/pricing).
2. **`items.attributes`** default → `'[]'` (ordered array `[{key, value}]`; the
   `key` = the `item_attribute` code, e.g. `size`, resolved to label/type at
   render).
3. **Write-path** — extend **item-edit** to set the **universal core** + the
   unit-driven conditional (`serves` / `time_unit`+periods / `size`) +
   `subcategory_id` + tags + tier (today: category-only). This is the keystone —
   import writes through it too. app-select reads the codelists; `subcategory_id`
   respects the existing `parent_id = category_id` trigger.

## Part B — Unit-driven fields (no profiles, no item_type) — BUILD FIRST
Every item has a **universal core** (always shown). The chosen **`unit`** is the
single selector that adds *at most one* conditional field, declared on the unit
itself as `item_unit.meta.needs`. There is **no `item_type` column** and **no
per-category profile machinery** — the real item table already carries
everything (`serves`, `time_unit`, `install_*`), and the unit tells the form
what to reveal.

**Universal core (always on):**
`name` · `description` · `currency` · `base_price` · `unit` · `install_description`
· `install_cost` · `install_unit` · `lead_time_days` · `location_coverage`
(plus index fields: `category_id`, `subcategory_id`, `tags`, `tier`, images.)

**Unit-driven conditional** — `item_unit.meta.needs` names the one extra field:

Unit is pruned to **5** (see Part A). `guest_count` is collected on the
**project**, never the item.

| unit | `meta.needs` | field the form adds | quantity at quote |
|---|---|---|---|
| **each** | — | (none) | `qty` (line) × base_price |
| **per guest** | — | (none) | `guest_count` (project) × base_price |
| **platter** | `serves` | **`serves`** appears | ⌈guests ÷ serves⌉ × base_price |
| **time** | `time_unit` | **`time_unit` + periods** appear | `qty` × base_price × periods |
| **size** | `size` | **`size`** label appears (→ `attributes`) | `qty` × base_price (size is just a label) |

**`time` and `size` are units** (pricing bases you pick, not hidden toggles):
- **time** reveals the `time_unit` dropdown (`item_time_unit`: day/hour/half_day/
  month/event) + a periods input; pricing gains `× periods`. A rented chair =
  `unit=time`, `time_unit=day`, qty 3.
- **size** reveals a free-text **label** field ("Small", "23x6x18", "50 sqm")
  stored in `items.attributes`; it's descriptive metadata and does **not** drive
  quantity — size items price by `qty`, exactly like `each`.

Units are mutually exclusive (V1) — a sized *and* timed thing (e.g. a marquee)
picks `time` and puts the size in the name/description.

**Pricing / quantity (all in `line-total.util.js`):**
`count × base_price × (periods?) + install_cost`, where **count** =
- `qty` — each / size,
- `guest_count` — per guest,
- `⌈guest_count ÷ serves⌉` — platter;
then `× periods` when `unit=time`; then `+ install_cost` (billed per
`install_unit`).

**Mandatory stance:** hard-required stays `name` + `category_id` only.
`serves`/`size`/`time_unit` **warn, don't block** when the unit calls for them;
`subcategory_id` warns.

**Item-edit renders:** the universal core always, plus the one `unit.meta.needs`
field (`serves` / `time_unit`+periods / `size`), plus subcat (categories) + tags
(tag table, by category) + tier. Save to the item.

**Pilot: the canapé tray** (`docs` example — `unit` should be **`platter`**,
`serves=50`): pick `platter` → `serves` appears → auto-quantity ⌈guests÷serves⌉ →
pricing + install. Then prove the other bases on one supplier: a **per guest**
canapé (guest_count drives qty), an **each** glass-pack (nothing extra), a
**time** chair rental (`time_unit=day` + periods), a **size** marquee (label).
One supplier/category holds them all.

## Part C — Import pipeline (load → prepare → review → transfer)
Oracle-style ETL as staging TABLES (not a schema).
1. **Step 0 — admin creates the supplier org** (target; `org_id` source).
2. **LOAD (relaxed)** — one batch = the whole xls (+ images), all categories.
   `import_batches` (org_id from JWT, filename, status, counts, audit) +
   `import_rows` (all-nullable strings). Only structural/delimiter errors fail.
   The file carries a **category column per row**.
3. **PREPARE — by category.** Group rows by category (validate against the 15
   macros → error/quarantine if bad). Resolve `unit` → look up `meta.needs` →
   **require the field it names** (`serves` for platter/table; `size` for
   measures) and `time_unit` if the row is time-based; determine tags, tier,
   subcategory. Outcomes per row: **clean · warning · error · quarantine** with
   `validation_notes` (e.g. "unit=platter but no serves").
4. **REVIEW grid — by category, one at a time.** Fix inline; resolve quarantine.
   **"Should we add?" alerts** — when a row implies a **subcat / tag / tier /
   unit / attribute** not in the vocabulary, surface an add-prompt (admin
   approves → the controlled add: a `reference_codelist_values` row, or a
   tag/subcat via its table, in the current schema). Never silently drop.
5. **① Loader accepts** (data valid) → **TRANSFER** — atomic `INSERT … SELECT`
   into `items` as **normal `pending` items** (as if manually added: not
   visible, not approved), each stamped with **`items.import_batch_id`**
   (provenance / "loaded from"). Images promoted to the media store with
   `image_approval_status = pending`.
6. **② Ballpark admin reviews & approves** — the existing publish/image gate →
   items go live. (Separate from ①.)
- **Images:** loaded in step 2, matched by filename/SKU in PREPARE (missing →
  warning/quarantine, drag-drop to fix), promoted at TRANSFER.
- **SKU upsert:** partial unique `(org_id, sku) WHERE sku IS NOT NULL AND
  deleted_at IS NULL`; provided SKU → in-place update of the draft; null SKU →
  name-dedupe (`lower(trim(name))`) skip/create.
- **Purge:** deferred (staging persists for now — add later).
- **Vocabulary adds** write to the current (preview) schema; master gets a clean
  seed population at prod cutover (no cross-schema propagation in V1).

---

## Build order (ship in slices) — unit-driven core first
1. **Seed codelists**: `item_tier` (+ backfill) · `mood` · `item_attribute`
   (`size`); **prune `item_unit` to 5 + add `meta.needs`**; move time granularity
   to `item_time_unit`.
2. **Universal core + write-path**: item-edit renders the 10 core fields, and
   `unit.meta.needs` reveals `serves` (platter), `time_unit`+periods (time), or
   `size` label (size). Prove across a **mix** on one supplier — a platter
   (serves → ⌈guests÷serves⌉), a per-guest canapé (guest_count), an `each`
   glass-pack, a `time` chair rental (periods), a `size` marquee (label).
3. **Import** (C): resolve `unit` per row → enforce `meta.needs`; group by
   category for tags/subcat/review; PREPARE/REVIEW → TRANSFER + `import_batch_id`.
Foundation (1-2) is codelist seed + one form; import (3) is the only heavy build.

## Acceptance (high level — expand per slice in the shipped file)
- [ ] `item_tier`/`mood`/`item_attribute(size)` seeded; `items.tier` backfilled;
      `item_unit` pruned to 5 with `meta.needs`; time granularity in
      `item_time_unit`.
- [ ] item-edit shows the universal core always; **platter** reveals `serves`;
      **time** reveals `time_unit`+periods; **size** reveals the label field
      (→ `attributes`). Nothing extra for `each` / `per guest`.
- [ ] Quantity/pricing branch correctly per unit (esp. platter's ⌈guests÷serves⌉,
      time's `× periods`, and the `+ install_cost` term).
- [ ] A **mixed** catalogue (platter + per-guest + each + time + size in one
      supplier) each gets the right field + math.
- [ ] Import resolves unit → enforces `meta.needs` per row; a mixed-category xls
      loads → prepares by category → transfers as `pending` items tagged with
      `import_batch_id`.
- [ ] "Should we add?" adds a codelist/tag/subcat value (human-gated); nothing
      auto-mints.
- [ ] SKU upsert + name-dedupe behave; images match + promote with
      `image_approval_status=pending`.
- [ ] org_id from JWT/created org, never the file (API audit checklist for every
      new route). No AI calls in V1.

## Concerns not in spec
Standard section. Flag: the `items.attributes` default flip; pruning `item_unit`
to 5 + moving time granularity to `item_time_unit` (data re-point for affected
items); and any migrate-schemas additions (import tables, `items.import_batch_id`).

**Profiles — deferred, gated on new attributes.** V1 needs none: the universal
core + the 5 units (`serves`/`time`/`size` via `meta.needs`) cover every current
item (real `items` table confirmed). Profiles (category- or kind-scoped
attribute *sets*) re-enter **only when `items.attributes` grows past `size`** —
i.e. when we add spec attributes like power/material/dimensions that apply to
some categories and not others. That is the deferred item-attributes arc, not
this one. Don't build profile machinery until a real new attribute demands it.

---

## Appendix — the 5 units + `meta.needs` (paste-ready)
No new codelist — prune the existing `item_unit` to 5 and set `meta.needs` on
each. `needs` = `null` (nothing extra), `"serves"`, `"time"` (→ time_unit +
periods), or `"size"` (→ free-text label in `attributes`).

Keep 5; deactivate the rest (`is_active=false`, keep rows for history) and
re-point existing items.

| code | label | `meta.needs` | absorbs (deactivate + re-point) |
|---|---|---|---|
| each | Each | — | unit · item · pair · set · package · pallet · panel · letter · load |
| per_guest | Per Guest | — | head · cover |
| platter | Platter | `serves` | table |
| time | Time | `time` | day · hour · event · half_day · month |
| size | Size | `size` | sqm · sqft · linear_m · cbm |

`item_time_unit` stays as the **time granularity** shown when `unit=time`
(day/hour/half_day/month/event).

**`item_attribute` seed (V1 = one value):**
| code | label | meta |
|---|---|---|
| size | Size | `{ "value_type": "char", "filterable": false }` |

Quantity/pricing inputs come from context: `periods` = line/event input,
`guest_count` = project, `serves` = the item; `size` is a descriptive label only.
`line-total.util.js` picks the count basis from the unit (`qty` for each/size,
`guest_count` for per_guest, ⌈guests÷serves⌉ for platter), layers `× periods`
when `unit=time`, then `+ install_cost`.
