# pV2-STORE-IMPORT-01 — Item Load & Profiles (v0.2.0)

**Type:** server + client-v2 · the item-onboarding arc
**Owner:** CC implements + commits. Chat authored this. Tracker:
**FR-00202** (load) · **FR-00204** (foundations) · **FR-00208** (profiles),
all under Items/Taxonomy epics. Target **v0.2.0**.
**Design docs:** `docs/item-import-one-pager.html`, `docs/item-attributes-one-pager.html`,
`docs/item-taxonomy-arc-roadmap.md`.

One merged workstream (foundations are just seeding, so not a separate phase).
Build in the order below; each part is shippable on its own.

## Guiding principles (hold throughout)
- **Codelists for every flat vocabulary.** Reuse the existing engine
  (`reference_codelists` + `reference_codelist_values` + `codelist.service.js`) —
  do NOT invent a parallel one. Tier, mood, attributes are all codelists.
- **code = canonical / label = flexible.** Logic, matching and storage key off
  `code`; the display is `label` and can be relabelled freely (statuses already
  work this way; Jira-style). Synonyms collapse to one code + a chosen label —
  which is also the anti-proliferation firewall.
- **No AI in V1.** Subcategory is *picked*; attributes/tags/tier come from the
  profile + codelist matching. The classifier (Phase 2) is out of scope here.
- **org_id is sacred** — from the created supplier org / JWT, never the file.
- **Controlled extension only** — new vocabulary enters only via the
  human-gated "should we add?" gate (a new `reference_codelist_values` row, or a
  new tag/subcat via its table). Nothing auto-mints.

---

## Part A — Foundations (seed + write-path)
1. **Seed codelists** via `codelists-seed.js` (`reference_codelists` +
   `_values`):
   - **`tier`** — ordered: Budget · Standard · Premium · Luxury · Aim for the
     Moon (by `sort_order`). Backfill `items.tier`: `basic→Budget`,
     `mid→Standard`, `premium→Premium`; leave nulls.
   - **`mood`** — Relaxed · Celebratory · Impressive · Sophisticated · Intimate
     (hidden in UI for now; classifier-fed later).
   - **`item_attribute`** — each value is an attribute (`dimension`, `material`,
     `power`, `serves`, `lead_time`, …); `meta` JSONB carries
     `{ value_type: number|char|description|list, unit?, required?, filterable? }`.
   - **list-type attribute values** — a codelist per `list` attribute (its
     allowed options).
2. **`items.attributes`** default → `'[]'` (ordered array `[{key, value}]`; the
   `key` = the `item_attribute` code, resolved to label/type at render).
3. **Write-path** — extend **item-edit** so it can set `subcategory_id` + tags +
   **tier** + **attributes** (today: category-only). This is the keystone —
   profiles and import both write through it. app-select reads the codelists;
   `subcategory_id` respects the existing `parent_id = category_id` trigger.

## Part B — `item_type` (the commercial archetype) — BUILD FIRST
The "profile" collapses to a single **derivable `item_type`** on the item —
**Purchase · Rent · Service · Food** — not per-category machinery. It's what the
item is *commercially* (a fridge and a par-can are both **Rent**), and everything
(pricing, quantity, which fields show) keys off it.

- **`item_type` codelist** (same `reference_codelists` engine): values
  **All · Catering · Purchase · Rent · Service**, each `meta` = behaviour flags
  `{ shows: [serves|time_unit], quantity_rule, pricing_rule }`. `All` is the base
  (universal fields, default); the others specialise on top.
- **`items.item_type`** — new column (additive, nullable; a codelist value). NB
  `kind` is taken by the shelved composition work — use `item_type`.
- **Set it by pick-or-derive:** manual create → app-select; import → **derive**:
  `serves present→Catering`, `time_unit∈(day,week)→Rent`, `unit=hour→Service`,
  else `Purchase` (default `All`; all confirmable in the review grid).
- **Behaviour keys off it** (uses ONLY existing fields):
  - All / Purchase → qty × base_price
  - Rent → qty × base_price × periods (`time_unit`)
  - Catering → ⌈guests ÷ `serves`⌉ × base_price (auto-quantity)
  - Service → base_price × hours × people (`time_unit`=hour)
  - item-edit shows `serves` for Catering, `time_unit` for Rent/Service;
    everything else is universal.
- **Spec attributes** (`dimension`, `material`, `power`…) are a **later,
  separate** concern — they live in `items.attributes` (JSONB) when a category
  needs them, via an `item_attribute` codelist. NOT required for V1.
- **Item-edit renders** — the universal fields always, plus the `item_type`-
  driven ones (`serves` for Food, `time_unit` for Rent/Service), plus subcat
  (categories) + tags (tag table, by category) + tier (universal). Save to the
  item.
- **Pilot: Catering (= the Food type)** — prove `item_type` end-to-end on
  Catering first: pick/derive → `serves` shows → auto-quantity (⌈guests ÷
  serves⌉) → pricing. Catering is the unique/richest type; the generic
  Purchase/Rent/Service follow from the same mechanism.

## Part C — Import pipeline (load → prepare → review → transfer)
Oracle-style ETL as staging TABLES (not a schema).
1. **Step 0 — admin creates the supplier org** (target; `org_id` source).
2. **LOAD (relaxed)** — one batch = the whole xls (+ images), all categories.
   `import_batches` (org_id from JWT, filename, status, counts, audit) +
   `import_rows` (all-nullable strings). Only structural/delimiter errors fail.
   The file carries a **category column per row**.
3. **PREPARE — by category.** Group rows by category (validate against the 15
   macros → error/quarantine if bad); **derive `item_type`** (from unit/serves/
   time_unit) per row; determine tags, tier, subcategory (+ any spec attributes
   later). Outcomes per row: **clean · warning · error · quarantine** with
   `validation_notes`.
4. **REVIEW grid — by category, one at a time.** Fix inline; resolve quarantine.
   **"Should we add?" alerts** — when a row implies a **subcat / tag / tier /
   attribute / attribute-value** not in the vocabulary, surface an add-prompt
   (admin approves → the controlled add: a `reference_codelist_values` row, or a
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

## Build order (ship in slices) — item_type first
1. **Seed codelists**: `tier` (+ backfill) · `mood` · **`item_type`**
   (Purchase/Rent/Service/Food + behaviour `meta`). (`item_attribute`/`dimension`
   deferred — not V1.)
2. **`items.item_type` + write-path**: item-edit sets `item_type` **per item**
   (independent of category); it drives `serves`/`time_unit` visibility +
   pricing/quantity. Prove across a **mix** — a Food platter, a Rent tablecloth,
   a Purchase glass-pack, a Service bartender — *one supplier/category can hold
   all four*.
3. **Import** (C): **derive `item_type` per row** (from unit/serves/time_unit,
   NOT category); group by category only for tags/subcat/review; PREPARE/REVIEW →
   TRANSFER + `import_batch_id`.
Foundation (1-2) is codelist seed + one form; import (3) is the only heavy build.

## Acceptance (high level — expand per slice in the shipped file)
- [ ] `tier`/`mood`/`item_type` seeded as codelists (item_type carries behaviour
      meta); `items.tier` backfilled.
- [ ] item-edit sets `item_type` per item (category-independent); `serves` shows
      for Food, `time_unit` for Rent/Service; pricing/quantity branch per type.
- [ ] A **mixed** catalogue (Food + Rent + Purchase items in one supplier) each
      gets the right type + behaviour (esp. Food's ⌈guests÷serves⌉ auto-qty).
- [ ] Import derives `item_type` per row (category-agnostic); a mixed-category
      xls loads → prepares by category → transfers as `pending` items tagged with
      `import_batch_id`.
- [ ] "Should we add?" adds a codelist/tag/subcat value (human-gated); nothing
      auto-mints.
- [ ] SKU upsert + name-dedupe behave; images match + promote with
      `image_approval_status=pending`.
- [ ] org_id from JWT/created org, never the file (API audit checklist for every
      new route). No AI calls in V1.

## Concerns not in spec
Standard section. Flag: profile storage (codelist meta vs light table — CC's
call, but reuse codelist infra if it fits); the `items.attributes` default flip;
and any migrate-schemas additions (import tables, `items.import_batch_id`).

---

## Appendix — `item_type` seed (paste-ready)
`reference_codelists`: `list_name='item_type'`, `consumer_table='items'`,
`consumer_column='item_type'`, `default_code='all'`, description "Commercial type
— how an item is transacted."

`reference_codelist_values` (list_name='item_type'):
| code | label | sort | meta |
|---|---|---|---|
| all | All | 0 | `{ "shows": [], "quantity": "qty", "pricing": "qty * base_price" }` (default/base) |
| purchase | Purchase | 1 | `{ "shows": [], "quantity": "qty", "pricing": "qty * base_price" }` |
| rent | Rent | 2 | `{ "shows": ["time_unit"], "quantity": "qty * periods", "pricing": "qty * base_price * periods" }` |
| service | Service | 3 | `{ "shows": ["time_unit"], "quantity": "hours * people", "pricing": "base_price * hours * people" }` |
| catering | Catering | 4 | `{ "shows": ["serves"], "quantity": "ceil(guests / serves)", "pricing": "ceil(guests / serves) * base_price" }` |

**Derivation** (import default + create hint): `serves present → catering` ·
`time_unit ∈ (day,week) → rent` · `unit=hour → service` · else `→ purchase`
(fallback `all`). Confirmable in the review grid.

Quantity/pricing inputs come from context: `periods` = event duration,
`guests` = project `guest_count`, `hours`/`people` = line inputs — so
`line-total.util.js` branches on `item_type`.

**Mandatory stance:** hard-required stays `name` + `category_id` only; `item_type`
defaults to `all`; type-specific fields (`serves`/`time_unit`) and `subcategory_id`
**warn, don't block**.
