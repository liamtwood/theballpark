# Item & Taxonomy Arc — Roadmap

How catalogue items, the taxonomy service, item import, profiles, images, and
event matching fit into one plan. Companion to
[taxonomy-and-categories-one-pager.md](taxonomy-and-categories-one-pager.md),
[item-import-one-pager.html](item-import-one-pager.html),
[item-attributes-one-pager.html](item-attributes-one-pager.html).

## Goal — one engine, three uses
Turn the catalogue into a **matchable index** and classify the **event** into the
**same vocabulary**, so one match engine (`taxonomy.service.matchItems`) serves:
**AI auto-select** (from a brief) · **guided** (wizard) · **search** (precise).
Supply side = items; demand side = events; match = the intersection.

## Critical path — shared controlled vocabulary
Both items and events must speak the same cross-cutting language:
**`tier · mood · event-type · occasion · capacity · area`**. Today they don't
(tier = 3 free-text scales, `event_type` uncontrolled, no `mood`). Fixing that is
what makes the two sides meet.

## Decided
- **Tier (2026-09-16):** ordered 5-step — **Budget · Standard · Premium · Luxury
  · Aim for the Moon** ("for now"). Backfill `items.tier`: `basic→Budget`,
  `mid→Standard`, `premium→Premium`; Luxury/Moon new; nulls stay null. Store
  **ordered** (lookup or constrained + app-order) so the matcher can range; it's
  its own axis (spans all categories), not a category-scoped tag. `projects.tier`
  looks like a plan tier → derive **event** tier from per-head budget going
  forward, best-effort backfill.

## What already exists (don't rebuild)
- `taxonomy.service.classifyItem` — Haiku classifier, anchored to the 15 macros,
  resolve-or-drop firewall (cannot mint terms). Tested live: strong; limits =
  confident *in-vocab* errors (need human QC) + confidence pinned ~0.95. **v1
  client only today.**
- `items.tier` (200/209, free-text), `items.attributes` (JSONB, **dormant 0/209**),
  `items.subcategory_id`, `kind`, `parent_item_id`.
- Demand side: `projects.parsed_brief_json` (city/dates/budget/eventType/
  categories/guestCount/**budgetSignal**/**topQuestions**), `projects.tier`,
  `event_type`, `guest_count`, `matchItems`.

## Phases
**Phase 0 — Foundations (unblocks everything)**
- Tier codelist (above) applied to items + event profile; align `event_type` to
  the taxonomy's 16; add **mood**.
- v2 **write-paths**: item-edit can set `subcategory_id` + tags + tier (today
  category-only). Nothing downstream can write without this.

**Phase 1 — Item import V1 (near-term: supplier onboarding)**
- Oracle-style ETL: `import_batches`/`import_rows`, LOAD (relaxed) →
  TRANSFORM/QUARANTINE → REVIEW grid → TRANSFER (atomic) → PURGE.
- One-load-per-category, SKU-keyed upsert, **picked-subcategory (no AI)**.
- (Design: item-import one-pager.)

**Phase 2 — AI into the pipeline (QC the service FIRST)**
- QC-pass `taxonomy.service` (much code since it was built), then wire
  `classifyItem` into import TRANSFORM (anchored to the picked category) →
  `pending_classification` → **human QC in the review grid**. Brings the
  classifier into **v2**.

**Phase 3 — Profiles + images**
- Item profiles: attributes layer (item_attribute codelist → `value_type` →
  fills `items.attributes`), drives item-edit + import templates.
- Images: zip/folder upload, match by filename/SKU, quarantine-missing,
  drag-drop in grid, decoupled `image_approval_status` (admin approves images;
  text edits don't re-trigger).

**Phase 4 — Event classification + matching (the payoff)**
- Event-profile (extract + infer + reflect-back/confirm) over the aligned vocab;
  match engine does demand ∩ supply for auto-select / guided / search.

## Open decisions
- **AI-in-V1 vs Phase-2** — lean Phase-2 (QC the service first). *(gates Phase 1/2 split)*
- **Item profiles** — the attribute-vs-tag rule + profile=whole-form + scope +
  required-blocks-publish? + storage (seeded config vs light table). *(gates Phase 3)*
- **Tier storage** — ordered lookup table vs constrained varchar + app-order.

## Dependency spine & recommendation
Phase 0 → 1 → 2; Profiles/images (3) and Event/match (4) both sit on Phase 0's
vocabulary. **Recommended start:** fold Phase 0 into **Phase 1 (import V1)** —
import needs the write-path + tier anyway, and it's the live need. Ship
picked-subcategory first, load real items, **then** QC the service and add the AI
micro-sort (Phase 2). Profiles/images and event matching follow on the same
vocabulary.
