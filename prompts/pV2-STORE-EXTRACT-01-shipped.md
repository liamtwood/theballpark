# pV2-STORE-EXTRACT-01 — Website catalogue extract (Analyse → Pull) — SHIPPED

**Build:** v2.519 (dev) · **Date:** 2026-09-21 · **Owner:** CC (ballpark-f2)
**Spec:** [pV2-STORE-EXTRACT-01-prompt.md](pV2-STORE-EXTRACT-01-prompt.md) · design [[project_catalogue_extract_design]]

Admin points at a supplier's web page → AI **analyses** what's there → on the admin's
go, **pulls** the catalogue in as **pending** items on that supplier org. Two guided-Haiku
steps, mostly assembly over existing infra. Deliberately minimal — the real extract data
tells us what to build next.

## What shipped
**Server**
- `services/ai.service.js` — extracted a shared `callHaikuJson({system,user,maxTokens})` helper
  (Haiku + maxRetries:8 + JSON-out/fence-fallback + 503 overload mapping); **refactored the
  inbox `parseBrief` onto it** (no behaviour change) so there's one AI-call definition. Added
  two guided prompts + functions: `analyseCatalogue` (guided-but-honest report) and
  `extractProduct` (one product → item shape).
- `services/org-import.service.js` — generalised the SSRF-safe, IP-pinned guarded fetch into an
  exported `guardedFetch(url)` (any page, redirects re-vetted per hop); `extractOrg` now uses it
  (no fetch-stack duplication).
- `services/catalogue-extract.service.js` (NEW) — orchestrates: `guardedFetch` → `htmlToText`
  (+ on-page hrefs for listing detection) → AI → `ItemService.createForOrg` (**pending**).
  Maps to **real item columns** where homes exist (base_price, unit, description,
  install_description, install_cost, lead_time_days, category_id); dimensions + other key:values
  → `attributes` bag; volume tiers → `attributes.price_tiers`; single-group options →
  `kind='option'` child items (0/upcharge, hidden from browse). Source identity: primary URL →
  the dedicated **`external_url`** column; sku/product_id/supplier_ref/extracted_at/batch → an
  internal **`attributes._source`** block (`_`-prefixed → view/editor skip it). **Dedup** on
  `external_url` or `_source.sku` → a re-run adds only new products.
- `services/taxonomy.service.js` — brief-matcher no longer falls back to `external_url` for an
  image (it's a product-page URL now, never an image).
- `routes/admin-orgs.js` — `POST /:orgId/extract/analyse` (read-only) + `POST /:orgId/extract/pull`
  ({urls[]}). Platform-admin gated (inherits the `/api/admin` gate); org from the URL, never the body.
- **No schema change** — everything fits existing columns.

**Client (client-v2)**
- `core/admin-org.service.ts` — `extractAnalyse` / `extractPull` + `ExtractReport` / `PullResult` types.
- `pages/suppliers/website-import-panel.component.ts` (NEW) — "Import from website" panel: URL →
  Analyse (page shape, verdict, mapped chips, "also found", sample, product-link picker for
  listings) → Pull → per-URL result summary. Curation stays in the existing item editor.
- `pages/suppliers/supplier-detail.component.ts` — mounts the panel on the **Shop tab, admin-only**.

## QC (preview, platform admin)
1. Admin → a supplier → **Shop** tab → **Import from website**.
2. Paste a **Yahire** product URL → **Analyse** → report (detail page, verdict, price/tiers/options/SKU
   chips, "also found", sample). Paste a Yahire **category** URL → listing + product-link picker.
3. Paste **Rocket Food** (caterer homepage) → verdict "no catalogue — onboard manually" (no junk).
4. **Pull** → items created **pending** on the supplier → review in **Approvals**. Check: attributes/
   dimensions in the bag, tiers in `attributes.price_tiers`, single-group options as hidden children,
   `external_url` = the product page.
5. **Re-run** the same URL(s) → skipped (dedup), only new products added.

Requires `ANTHROPIC_API_KEY` on the server env (already set on preview). Runs on preview first.

## NOT in v1 (analyse NAMES these; prioritise from real data)
Promote-attribute-to-codelist, description-vs-attribute routing UI, multi-group priced variant
matrices, venues, packages, scheduled/auto refresh, a hard-dedup indexed `source_ref` column.

## QC iterations

**v2.525 (2026-09-21)** — post re-pull (item 981f9411 verified: image, category, tiers, options,
dimensions all correct). Two follow-ups:
1. **Subcategory** — the classifier resolved the category (Furniture & Fixtures) but the AI didn't
   pick a subcategory, and `applyClassification` then cleared `pending_classification` → a silent
   category-only item. Fix in `classifyAndApply`: when a category is applied but NO subcategory was
   picked AND that category HAS live subcategories, re-flag `pending_classification` (with
   `needs_subcategory`) so an admin completes it — an item lands cat+subcat or is flagged, never
   silently category-only. (F&F does have subcats — the POC chair carried one — so this is the path.)
2. **Gallery images** — nudged the pull prompt to capture ALL of a product's photos (angles/variants,
   1-4), hero first, still excluding logos/other-product thumbnails (was often returning just the hero).
Verified: the categorised pending chair matches the admin Shop browse (shows in the yahire Shop tab).

**v2.523 (2026-09-21)** — extraction-quality + visibility batch (Yahire chiavari chair QC):
1. **Images** — `htmlToText` stripped `<img>`, so the AI never saw image URLs (items had no
   photo). Now collects `<img src>` + lazy attrs (`data-src`/`data-lazy`/`data-original`) +
   `srcset` first URL into an "IMAGES ON PAGE" block; prompts point at it. Verified: 0→populated.
2. **Dimensions** — DIAGNOSED, not forced: the chair's raw fetched HTML contains NO dimension
   data (no `cm`/depth/weight/material, no `<table>`; `height`/`width` are only `og:image` meta;
   an `accordion` is present but its content isn't in the static markup). So dimensions are
   JS-rendered or unpublished → a rendered-fetch question, flagged (no prompt hack).
3. **Volume-tier boundaries** — root cause: extract wrote `{minQty,price}` but the canonical
   shape (item-edit + line-pricing) is `{min,max,price}` → ranges undefined → all 1-∞/overlapping.
   Fixed: prompt returns per-tier `min`/`max`/`price` with distinct lower thresholds; the service
   sorts by `min` and DERIVES each `max` from the next tier's `min−1` (last open-ended) so ranges
   never overlap even if the model returns min=1 for all.
4. **Category + subcategory** — the AI now gets Ballpark's category vocabulary and maps to it
   (verified "Chair Hire" → "Furniture & Fixtures"); `matchCategoryId` does exact + child→parent.
   Setting `category_id` at pull time also lets the auto-classifier assign a **subcategory** under
   it (classifyItem uses item.category_id as the parent), and leaves `pending_classification` set
   when it can't — the review flag.
5. **Options kind** — `ItemService.create()` silently dropped `kind`, so option children landed
   `kind=NULL`. Added `kind` to create() → option children are now `kind='option'`.
6. **My-Shop visibility (safety net)** — null-category items were dropped from the supplier's
   category counts (INNER JOIN) → "All Categories 0" and hidden in category browse. Now a LEFT
   JOIN + an **"Uncategorised" bucket** (id `uncategorised`); `/api/marketplace/items?cat=uncategorised`
   → `category_id IS NULL`. An item is never invisible for lacking a category.

**v2.522 (2026-09-21)** — Liam QC: the Analyse report didn't mention images (Pull already
captured them fine). Reporting-only fix in `ANALYSE_SYSTEM` (+ its JSON shape): added
`mapped.hasImages` (boolean) and `images[]` to the `sample` object, so the report shows
images-present + the sample's photo URLs. Client: `ExtractReport.mapped.hasImages` + an
"images" chip in the panel (the sample already renders as JSON). Pull unchanged.
