# pV2-STORE-EXTRACT-01 — Website catalogue extract (Analyse → Pull), simple first pass

**Type:** server + client-v2 · new capability. **KEEP IT SIMPLE** (Liam) — minimal
first pass; let the real extract DATA tell us what to build next.
**Owner:** CC implements + commits. Chat authored 2026-09-21.
**Goal:** let an admin point at a supplier's website, get an **AI analysis** of what's
there, and **pull** the catalogue into Ballpark as **pending** items on that supplier
org. Two guided-AI steps, reusing the inbox brief-parser pattern.

Prototype validated live (2026-09-21) on Yahire (full: price/tiers/dims/**7 options**),
Juno (subset, no price/options), Adana (multi-group print options), Rocket Food
(caterer homepage — correctly reported "no catalogue"), Space & People (venue
marketing page). Learnings in [[project_catalogue_extract_design]].

## Reuse (this is mostly assembly, not new infra)
- **AI call:** `server/src/services/ai.service.js` — the inbox brief parser's pattern:
  a guided `SYSTEM_PROMPT` over an Anthropic **Haiku** call, JSON-out + markdown-fence
  fallback. Add TWO new guided prompts (analyse, pull); reuse the client/parse plumbing.
- **Fetch:** the `org-import.service.js` **guarded fetch** (SSRF-safe, IP-pinned,
  timeout, size cap) to pull page HTML/text. No new fetch stack.
- **Write:** `createForOrg` (the admin org-scoped item create) → items land **pending**.
  Do NOT re-implement item creation.
- **Curate:** the EXISTING `item-edit.component` (admin edits the pending item). No new
  curation UI in v1.

## Step 1 — ANALYSE (guided AI, READ-ONLY, writes nothing)
Admin (on a supplier's Shop tab, or a small "Import from website" panel) pastes a URL
→ guarded-fetch the page → one guided-AI call → return a structured **report**:
- **Site shape:** detail page / listing page / marketing-only (the AI classifies it).
- **Verdict:** "pull-able: ~N items across these categories" OR "no catalogue — onboard manually."
- **Mapped to Ballpark** (the AI LOOKS FOR our expected set): categories + subcategories;
  item count; per-item core (name, price ex-VAT); volume tiers present?; options present?;
  our known attributes (dimensions…) present?
- **Also found** (the AI MENTIONS everything else — nothing dropped): any attribute /
  spec / feature on the page that ISN'T in our expected set → listed so the admin sees it.
  This is where "new attributes" and "no place for it yet" (venue capacity, packages,
  multi-group variants) get NAMED — not built, just surfaced.
- **One sample item** fully parsed, so the admin sees extraction quality before pulling.

**Guiding principle for the analyse prompt: guided by our schema, honest about everything
else.** Look for what we expect; mention whatever it finds.

## Step 2 — PULL (only on the admin's go)
For each product page (a detail URL directly, or the detail links found on a listing
URL): guided-AI extract → **map to the REAL item fields** (the model has proper homes —
don't over-dump into attributes) → `createForOrg(orgId, …, defaultStatus 'pending')`:
- `name`, `base_price` (ex-VAT; VAT org-level), `description`, images (`image_url`/`images`),
  `category_id`/`subcategory_id` (map if a Ballpark category matches, else leave for review),
  `unit` (each/head/hour/day; default 'each'), and where present: **`serves`** (per-guest),
  `install_description`/`install_cost`/`install_unit`, `lead_time_days`, `location_coverage`, `tier`.
- **Source URL → `external_url`** — this column's documented purpose is "link to the
  supplier's own product page", so it's the natural home (a real column, the primary dedup/
  delta key). ⚠ FIX FIRST: taxonomy.service.js:730 misuses `external_url` as an image
  fallback (`image_url: it.image_url || it.external_url`) — drop the `|| it.external_url` so a
  product-page URL never renders as a broken image once we populate it.
- **Other source ids** (sku, product_id, supplier_ref, extracted_at, batch) → the internal
  `_source` JSON in `attributes` (multi-id extras; `_`-prefixed so view/editor skip it).
- **Attributes** (dimensions + any key:value with no dedicated column) → the **`items.attributes`
  JSON bag** (flexible catch-all — nothing is ever "unplaceable"). Prose → `description`.
- **Volume tiers** → `attributes.price_tiers` (the guide tiers, [[project_price_is_a_guide]]).
- **Options** (single group, e.g. colours) → `kind='option'` child items, price 0 or
  upcharge, hidden from browse (`parent_item_id` already excluded by the marketplace query).
- **Source identity (capture from day one — this is what enables delta/refresh LATER):**
  store an INTERNAL `_source` block in `items.attributes` holding **every stable id the
  supplier exposes** (several if present): `{ sku, product_id, source_url, supplier_ref,
  extracted_at, batch }`. INTERNAL / NOT SURFACED — the `_`-prefix means the item view +
  editor **skip it** (they render only non-`_` attributes). Add "supplier item id / SKU" to
  Analyse's "look for" list so the AI pulls it. Different suppliers key differently, so
  capture all available (more match points = more reliable matching).
- **Dedup / refresh:** skip a product already imported (match `_source.sku` or
  `_source.source_url`, else name+org); create only new ones — so a re-run pulls only newly
  added products. (A dedicated indexed `source_ref` column + unique `(org_id, source_ref)`
  constraint for HARD duplication prevention is the delta-hardening step — added LATER with
  the delta feature, not v1.)

Everything lands **PENDING** → reviewed/approved via Approvals (never auto-live). Runs on
**preview** first. Platform-admin gated.

## Explicitly NOT in v1 (analyse NAMES these; we prioritise from real data later)
- Promote-attribute-to-codelist loop; a description-vs-attribute routing UI (curate in the
  existing item editor for now).
- Multi-group / priced variant matrices (Adana Size×Qty×Material) — options v1 = single group.
- **Venues** (different entity) and **packages** (bundles) — analyse reports them, doesn't model them.
- Generic multi-site tuning beyond the guided prompt; scheduled/auto refresh.

## Acceptance
- [ ] Admin pastes a Yahire product/category URL → **Analyse** returns a report:
      site shape, verdict, mapped (cats/items/tiers/options/attrs), **"also found"**, one sample.
- [ ] Analyse on a non-catalogue site (Rocket Food) → verdict "no catalogue — onboard manually" (no junk).
- [ ] **Pull** creates the items as **pending** on the supplier org via `createForOrg`;
      attributes in the JSON bag, tiers in `attributes.price_tiers`, single-group options as `kind='option'` children.
- [ ] Re-running skips already-imported products (dedup) and adds only new ones.
- [ ] Reuses `ai.service.js` (Haiku + guided prompt + JSON fallback) + the org-import guarded fetch + `createForOrg` — minimal new code.
- [ ] Guarded fetch (SSRF), platform-admin gated, preview only. Build clean; push dev; shipped note.
      QC: admin → supplier Shop tab → Import from website → paste Yahire → Analyse (report) → Pull → Approvals.
