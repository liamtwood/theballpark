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

**v2.527 (2026-09-21)** — dimensions shape-conformance: the extract wrote dimensions as FLAT
attribute keys (attributes.depth_cm / width_cm / material …) but item-edit reads the DEFINED shape
`attributes.dimensions = [{label,value}]` → captured but ignored ("No dimensions"). Fix: new
`toDimensions()` converts the AI's flat spec bag → `[{label,value}]` with canonical labels aligned
to the editor's measureSuggestions (Height/Width/Depth/Weight/Seat Height/Volume/Material; else
humanized raw key) and the unit folded into the value (width_cm:39 → {Width,"39 cm"}; weight_kg:3.4
→ {Weight,"3.4 kg"}; material:"Wood" → {Material,"Wood"}). Flat keys dropped; price_tiers[] +
_source unchanged. The extract now writes the structured shapes the item model already defines.
Verified toDimensions output on a chair-like bag.

**v2.526 (2026-09-21)** — subcat RESOLVED not flagged; fully automatic at volume (Liam: 100s of
items, no per-item manual work):
- Root cause: `classifyItem` did FREE-TEXT name matching (AI says "Chairs", taxonomy child is
  "Seating" → no match → null). Fix: a GUIDED PICK — new `pickBestSubcategory` gives the AI the
  REAL child list under the resolved parent and maps by MEANING; verified "Chiavari Chair" →
  "Seating". ALWAYS returns a child (defaults to a general/first child if the model finds none) —
  `subcategory_id` is never null when the parent has children.
- Category never null: pull-time `matchCategoryId` falls back to the 'Other' catalogue category.
- `pending_classification` is now a SOFT marker only: the item is fully assigned (cat+subcat) +
  visible regardless; only UNCERTAIN picks (default-child fallback or AI confidence < 0.5) are
  re-flagged (`soft_review`) for an OPTIONAL bulk pass. Never blocks, never needs per-item work.
- Images: pull prompt asks for all product photos (hero first).

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

## QC iteration — v2.537 (Analyse = whole-site crawl → task list)
Analyse now treats a HOMEPAGE URL as a whole-site request (Liam: "the analyse is our way of
building a task list"). Server: crawlSite() does a bounded BFS (<=40 pages) from the homepage,
same-host, skipping assets + non-catalogue pages; pickItemUrls() then selects the item pages
heuristically (the /category/product pattern — depth-2 paths under a category root; query-string
URLs dropped) — deterministic + free (no per-page AI). analyse(homepage) returns pageShape="site"
+ productLinks = the task list + crawledPages/discovered counts. A specific listing/detail URL
still does the single-page analyse. Verified on yahire.com: 40 pages crawled, 555 URLs discovered,
156 item pages in the task list (chiavari-chair-hire, round-table-hire, …) in ~11s.
Client: the panel now shows the task-list picker for the crawl (not just listings) with a
Select all/none toggle, default-selects all, and Pull sends the selected set. MAX_PULL_URLS raised
to 100 (small catalogues in one go); >100 selected pulls the first 100, rest via a second Pull
(dedup skips the done ones). REFINE LATER: depth-2 heuristic is tuned to /category/product sites;
other URL shapes + a cost/time guard on very large sites to follow.

## QC iteration — v2.541 (gap report + Review/Full pull mode)
Two things Liam asked for, both riding on infrastructure already there (no new AI calls beyond the
per-item Pull that always existed; Analyse is still 100% AI-free):
1. **"Found but couldn't store yet" gap report.** PULL_SYSTEM now also returns `noHome[]` — the honest
   list of data ON the page with no home in our model: foreign named sections (e.g. "Manufacturer:
   Sony", "Connectivity / In the box"), non-key:value assets (user-guide/spec-sheet LINKS or
   DOCUMENTS), per-combination variant matrices, and commercial terms (delivery zones, MOQ, hire
   periods). pull() aggregates these across the imported items into `gaps[] = {label, kind, count,
   example}` (sorted by count) and the panel shows them after import ("per-colour variant pricing —
   12 items"). This is the self-improving signal: it tells us which attribute GROUPS / value TYPES to
   add next (Liam's call: manually extend from real examples, don't auto-mint groups per supplier).
   Zero extra cost — rides on the extract call Pull already makes.
2. **Review / Full pull mode.** `pull(orgId, urls, {mode})`. Review (default) keeps the lean vetting
   set — name, description, base_price, unit, category, ONE hero image — and drops describe-groups,
   options, price_tiers, install_*, lead_time (attributes narrows to the internal `_source` block so
   re-run dedup still works). Full = everything mappable, run after the supplier contracts. Route +
   client service + `PullResult.{mode,gaps}` plumbed; panel has a two-radio mode switch (pink
   `.bp-radio`, no blue). Also: `ExtractPullBody.max` bumped 40→100 to match MAX_PULL_URLS (a >40
   selection used to 400).

Same commit also killed the browser-default **blue** on the task list (Liam: "I never want the blue"):
`.bp-check` gains an accent focus-visible ring + an accent indeterminate DASH (was native blue), the
bare accordion toggle gets `.bp-accordion-toggle` (no blue focus box, accent when keyboarded), and
category headers read `(5)` not `(5/5)` (v2.540).

## QC iteration — v2.542 (wrong image = lazy-loaded gallery; + Done button)
Liam QC (Yahire gazebo pull): both gazebos got the SAME generic image
(`gazebo-hire-outdoor-event-london.webp`). Root cause: Yahire **lazy-loads** the product gallery —
the static `<img src>` is a placeholder (`product.webp` ×3) and the only gazebo-ish real image in the
static markup is the category-nav banner, so the AI/fallback picked that banner for every gazebo.
The REAL product photos are in the page's **JSON-LD** (`schema.org` `Product.image[]`), which we
weren't reading. Fix: new `collectJsonLdImages()` walks every `ld+json` block and pulls `image[]`
from Product-typed nodes only (skips Organization/WebSite slideshow banners); `collectImageUrls()`
now leads with those, then the `<img>` URLs. Verified per-product heroes: 3m → `gazebo-hire-london-3m.jpg`,
large → `large-gazebo-hire-black.png` (distinct + correct). This is the general fix for the "JS-rendered
gallery" class (same family as the v2.523 JS-rendered-dimensions note). Existing wrong-image items need a
delete + re-pull (pull dedups on external_url, doesn't update).
Also (Liam UX): after a Pull completes the panel now HIDES the analyse/picker/Pull controls and shows
the confirmation + gap report + a **Done** button (`done()` clears the panel back to the URL input;
the shop grid below has already reloaded via the `pulled` emit). ExtractPullBody note carried from v2.541.

## QC iteration — v2.543 (Prepare step: consistent cat + subcat, supplier-driven)
Liam QC: two identical gazebos landed in DIFFERENT top-levels (Event Accessories vs Stand Structure)
with inconsistent/absent subcats — because classification was a per-ITEM AI guess. Redesigned into a
3-step import (Liam: "analyse — counts+groups, pick what you want; **prepare** cat+subcat; **load** pick
type"):
- **Analyse** (unchanged): crawl → task list grouped by supplier category (URL 1st segment), AI-free.
- **Prepare** (NEW): for the SELECTED groups only ("we only AI what we're about to load"), one Haiku
  call per group maps the supplier's category → a Ballpark **category + subcategory**. It trusts the
  supplier's own grouping (they grouped these as "gazebo" — we mirror it, one cat/subcat per group).
  Picks an existing subcat when close, else proposes a NEW one in house style (Title Case, no "Hire":
  "Gazebo Hire" → "Gazebos"). Verified: gazebo-hire → Stand Structure ▸ Outdoor & Tensile Structure
  (conf 0.95, existing). Panel shows an editable row per group (cat + subcat dropdowns, NEW badge +
  name field); the reviewer confirms/overrides before loading.
- **Load** (was Pull): the confirmed mapping is AUTHORITATIVE — every item in a group gets that
  cat/subcat, a NEW subcat is created once under the category, and the per-item AI classifier is
  SKIPPED (`createForOrg({skipClassify})`). No mapping → old per-item behaviour.

Junk taxonomy handled: the extractor now only offers the 15 real marketplace categories
(`namespace='catalogue'` AND name NOT LIKE 'rlstxn%'); the `feedback`-namespace trackers (Bug,
Question, Sprint, Test Run…) and RLS test fixtures are excluded from Prepare + the AI vocabulary.
Server: `marketplaceCategoryTree()`, `prepare(groups)`, `classifyGroup()` in ai.service (aliased on
import to dodge the existing attribute-router `classifyGroup`), `resolveMappingRow()` creates new
subcats (mirrors a curated subcat row: catalogue ns, level 1, enabled), `pull(orgId,urls,{mode,mapping})`.
Route: `POST …/extract/prepare`; pull body gains `mapping`. Client: `extractPrepare`, `PrepareResult`,
the 3-phase panel (select → Prepare → editable mapping + Load). NOTE the taxonomy junk still wants a
proper cull in the planned DB review — this just stops the extractor seeing it.

## QC iteration — v2.544 (Analyse a single section/category URL)
Liam: entering a category URL (`…/gazebo-hire`) should crawl BELOW it so a subcat can be processed on
its own, instead of the old single-page analyse. `crawlSite` gained a `prefix` param (path-scoped BFS)
and `analyse` now branches on path depth: homepage (0) → whole site; **section root (depth 1) → crawl
just that section** (`/gazebo-hire` → only `/gazebo-hire/*`); product URL (depth ≥2) → single-page
analyse. Server-only. Verified: `/gazebo-hire` → "Crawled the Gazebo Hire section (3 pages), found 2
item pages" → both gazebo products, AI-free.

## QC iteration — v2.545 (Prepare classifier reasons from category DESCRIPTIONS)
Liam QC: gazebo was suggested Stand Structure ▸ Outdoor & Tensile Structure — defensible but not his
instinct (he'd pick Furniture ▸ Outdoor Furniture); chairs was perfect (Furniture ▸ Seating). The
classifier only saw category NAMES. Now it's fed each category's `description` (all 15 top-levels have
one; "Stand Structure" = "exhibition stands, custom builds…") AND subcat descriptions WHERE PRESENT —
so it maps by MEANING, not keyword, with a rule to pick "where a real planner would look". Verified:
chairs stayed Furniture ▸ Seating; gazebo still leaned Outdoor & Tensile (a genuine tie — that subcat
IS a valid gazebo home — so the editable override remains the tool for ties). Key enabler: subcat
descriptions are EMPTY today; populating them (Liam: "there's a field for it") now steers picks with
zero further code — e.g. describe "Outdoor Furniture" to include gazebos/parasols. `marketplaceCategoryTree`
carries descriptions (cat + subcat); `classifyGroup` renders them; CLASSIFY_GROUP_SYSTEM reasons from them.

## QC iteration — v2.548 (whole-catalogue crawl: real products by signal + supplier-hierarchy grouping)
Liam QC exposed that the depth-2 heuristic grabbed the supplier's SUB-LISTING pages as items (catering
→ crockery-hire/cutlery-hire/glassware-hire… are category pages, not products) and missed the real
products a level deeper. Redesigned around two facts proven by probing Yahire:
- **Product detection is deterministic + AI-free:** a real product page carries schema.org
  `"@type":"Product"` JSON-LD (+ Offer/price) and is a leaf; listing pages don't (ItemList/Breadcrumb +
  many children). `isProductHtml()` tests it during the crawl — correct at depth 2 AND 3.
- **The URL path IS the supplier's hierarchy** (already stored in `external_url`). So we group by the
  PARENT path, retaining their structure at any depth: `/gazebo-hire/3m` → "gazebo-hire";
  `/catering-equipment-hire/crockery-hire/plate` → "catering-equipment-hire/crockery-hire".
Changes: `crawlSite` now also returns `products[]` (pages passing the signal) and `analyse` is unified —
it crawls SCOPED to the given URL's path (homepage → whole site; a section → just below it; a product →
itself), no more depth heuristic or single-page AI analyse. `groupKeyOf` = parent path; `groupLabel` =
leaf humanised; `groupPathLabel` = full path (fed to the classifier for richer context). CRAWL_MAX_PAGES
40→250 (ceiling; verdict warns + says narrow to a section when hit). Client `grouped()` mirrors the
server parent-path key (so the Pull mapping aligns) and shows the humanised leaf. `pickItemUrls` kept as
a fallback for sites with no Product JSON-LD. Verified: crockery-hire → 54 pages, 53 real products, one
group key, ~19s; no listing pages pulled. Since Liam does the load (automated, not the supplier), Prepare
still auto-maps each supplier sub-group → Ballpark cat ▸ subcat (existing or NEW), his override. A very
large full-site crawl is bounded by the cap → process section-by-section (which was the goal anyway);
concurrency/pagination is the future optimisation.

## QC iteration — v2.549 (robust product detection across platforms + feed skip)
Liam tested a Shopify site (edierose.co.uk) — the bare `"@type":"Product"` signal both MISSED Shopify
products (their product pages have og:type=product, no JSON-LD) and false-positived on collection pages
+ `.atom`/`.oembed` feeds. `isProductHtml` now combines signals: og:type=product → yes; og:type=
product.group (Shopify collection) → no; else JSON-LD Product+Offer (Yahire) → yes. CRAWL_SKIP now drops
`.atom/.oembed/.rss/.json//feed`. `groupKeyOf` special-cases Shopify/Woo flat product URLs
(`/products/<handle>`, `/collections/<c>/products/<handle>`) — grouping by the COLLECTION, not the literal
"products" segment (client mirrors it). Verified: edierose /collections/all → 166 real products, no junk
(60s/178 pages). KNOWN LIMIT (→ profiles): Shopify collections are tags + products are flat, so
"/collections/all" flattens to one group and per-collection grouping + cross-collection dedup aren't
solved by URL crawling. Next architecture: per-platform PROFILES (Liam) — detect Shopify/Woo/generic and
use the best parser (Shopify exposes /products.json + /collections.json — structured, no crawl). The
current JSON-LD crawler becomes the generic/fallback profile.

## QC iteration — v2.550 (cross-collection dedup by product handle)
Liam: Shopify "All"/"Front Page" collections overlap the real ones, so selecting both produced
duplicates (same product, different collection URLs, so external_url dedup missed them). Fix: pull()
now dedups the selection by PRODUCT HANDLE first (the `/products/<handle>` slug, identical across
collections), keeping the most SPECIFIC collection (`groupSpecificity` deprioritises all/front-page/
products/other) so the item also gets the real collection's cat/subcat — then caps. Verified: all+
dried-flowers/faux-mimosa and front-page+fresh-flowers/bloom-bouquet each collapse to the specific
collection; Yahire path URLs untouched. Result: you can leave "All" selected without dups.
Noted (→ Shopify profile): SKUs are NOT captured on Shopify today — they sit in a `<script>` product
JSON we strip before the AI reads the page (verified faux-mimosa sku 10753 present in HTML, absent from
htmlToText), and multi-variant products carry one SKU PER variant (bloom-bouquet: 32). Real SKU + price
+ product_type capture is a `/products/<handle>.json` (profile) job, and ties into the deferred
variant-matrix model.
