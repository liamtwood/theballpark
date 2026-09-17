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

## Part B — Item Profiles (compose the primitives) — BUILD THIS FIRST
A **profile = the item-type form for a category** — it *composes* existing
codelist primitives, it does not define new ones. **A profile is itself a
codelist** (same `reference_codelists` engine — no separate table/machinery).
- **`item_profile`** codelist: one value per category, `code` = the category
  (e.g. `catering`), `meta` = `{ attributes: [item_attribute codes], tags:
  [tag dimensions], tier: true, subcategory: true }` — i.e. which primitives that
  category's items use.
- Everything (tier · mood · attributes · **profiles**) is a codelist — one
  mechanism, one admin, one "should we add?" gate.
- **Item-edit renders the profile** — for the item's category, show its subcat
  select + applicable tag dimensions + tier + the profile's spec attributes
  (typed inputs; `list` → app-select). Save to `items.attributes` + the tag
  junction + `tier`/`subcategory_id`.
- **Pilot: Catering** — build ONE profile end-to-end and prove item-edit before
  generalising. Required attributes **warn**, don't block publish.

## Part C — Import pipeline (load → prepare → review → transfer)
Oracle-style ETL as staging TABLES (not a schema).
1. **Step 0 — admin creates the supplier org** (target; `org_id` source).
2. **LOAD (relaxed)** — one batch = the whole xls (+ images), all categories.
   `import_batches` (org_id from JWT, filename, status, counts, audit) +
   `import_rows` (all-nullable strings). Only structural/delimiter errors fail.
   The file carries a **category column per row**.
3. **PREPARE — by category.** Group rows by category (validate against the 15
   macros → error/quarantine if bad); per group **apply that category's
   profile**; determine attributes (cast by `value_type`), tags, tier,
   subcategory. Outcomes per row: **clean · warning · error · quarantine** with
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

## Build order (ship in slices) — profiles first
1. **Seed all the codelists** (A1): `tier` (+ backfill) · `mood` · `item_attribute`
   (incl. `dimension`) · **`item_profile`** (per-category composition in `meta`).
2. **Write-path** (A3 + B): item-edit reads the item's category → its
   `item_profile` → renders subcat + tags + tier + attributes → saves. Prove it
   on **Catering** first.
3. **Import** (C): staging + LOAD → PREPARE/REVIEW (Catering, applying its
   profile) → TRANSFER + `import_batch_id` → generalise to other categories.
The whole foundation (steps 1-2) is just codelist seed data + one form; the
import (step 3) is the only heavy build.

## Acceptance (high level — expand per slice in the shipped file)
- [ ] `tier`/`mood`/`item_attribute` seeded as codelists; `items.tier` backfilled.
- [ ] item-edit writes subcategory_id + tags + tier + attributes via codelists.
- [ ] Catering profile renders + saves end-to-end.
- [ ] A mixed-category xls loads → prepares by category → reviewable → transfers
      as `pending` items tagged with `import_batch_id`.
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
