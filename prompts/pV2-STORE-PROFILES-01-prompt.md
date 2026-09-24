# pV2-STORE-PROFILES-01 — Platform-profile extraction (detect + pivot)

**Status:** Woo profile SHIPPED (v2.582, 2026-09-24) · Shopify profile next

## SHIPPED — WooCommerce profile (v2.582)
`detectProfile(url)` (Store API 200 → 'woo'); `analyseWoo` pulls all products via
`/wp-json/wc/store/v1/products` (paged) grouped by primary category, returns the report +
`linkGroups` (permalink → {key,label}); the route sends Woo to the sync structured analyse
(not the fan-out). Pull: `processWooUrl` fetches each product from the Store API, groups by
its primary category (→ the Prepare mapping keyed by category slug), maps
name/price/desc/sku/images, `createForOrg` — **zero AI**. Client groups by `linkGroups`
(groupKey/groupLabel use it) since flat `/product/` URLs carry no hierarchy. Verified:
**Blue Sky 371 products / 16 clean categories** (crawler found 4), **Adana 23 / 6** (crawler
found 249 junk); a name-badges pull created structured with base_price £16 (min variation),
cost $0. Follow-up: variable-product VARIATIONS → options/variant pricing (currently base
price = min); a category-path scope for section-level Woo analyse.


**Context:** The generic crawler is the fallback profile. It works on path-hierarchy
sites (Yahire) but fails on WooCommerce: on adanaprint.co.uk it returned **249 false
positives** (phone numbers / pagination pages as "products"), grouped meaninglessly as
"Shop / Page", when the site really has **24 products in 9 categories**. Flat `/product/`
permalinks also collapse grouping. The fix is to **detect the platform at Analyse and
pivot the discovery + pull strategy** to a structured source.

## Detect the profile (deterministic, cheap)
- **Shopify** — `og:type=product.group`, `/collections/`, `myshopify`, or `/products.json` 200s.
- **WooCommerce** — `wp-content` + `/wp-json/wc/store/v1` responds (or `product_cat-sitemap.xml`).
- **Generic** — neither → today's crawler + path-hierarchy grouping (unchanged).

## WooCommerce profile (BUILD FIRST — Store API)
Verified live on Adana:
- `GET /wp-json/wc/store/v1/products/categories?per_page=100` → real categories (the
  grouping) + parent for hierarchy. Each product's `categories[]` gives membership.
- `GET /wp-json/wc/store/v1/products?per_page=100&page=N` → structured products: id, name,
  slug, sku, permalink, short/description, `type` ('simple'|'variable'), `prices`, `images`,
  `categories`.
- Variable products expose **variations with their own prices** → the quantity pick-list
  (e.g. name badges "5 → £16, 10 → £33") comes in as DATA, not AI-guessed per-unit tiers.

**Analyse (Woo):** fetch categories + products from the Store API → task list grouped by
real category with counts. No fan-out crawl (it's paged API, fast + structured).
**Pull (Woo):** per selected product, map name/desc/price/sku/images + `categories`→our
cat/subcat grouping + variations→variant/pricing. Near-zero AI (structured; AI optional
only for description→attribute routing). Dedup by sku/product id as today.

## Shopify profile (build next)
`/collections.json` + `/products/<handle>.json` (or `/products.json`) — structured products,
variants (real SKU/price), collection membership. Analyse from JSON, pull from JSON.
**Grouping caveat (verified on Grace & Thorn):** Shopify collections are campaign/product-
line, NOT categories (`rtw-wild-thing`), and a product sits in many — so DON'T group by
collection. The native `product_type` is better but INCONSISTENT (G&T: clean "Flowers/
Candles/Plants" but also campaign-y "WEDDING FLOWERS/EVENTS" and 65/250 BLANK). So the
Shopify grouping rule = **`product_type` where usable, else fall back to per-item AI
classify** (the per-item classifier already lands e.g. a bouquet on Florals ▸ Bouquets
correctly). Shopify catalogues will always need some reclassify — that's merchant data
quality, not the tool. (Contrast Woo: clean categories → near-perfect auto-grouping.)
Edie Rose is the other Shopify test case.

**Collections are NOT a grouping unit (verified on Grace & Thorn):** Shopify collections
are FLAT (no parent/child) and a product belongs to MANY — its nav collection
(`ready-to-wear-flowers`) AND its design-line collection (`ready-to-wear-vintage-fleur`).
So grouping by the collection in the product URL is both noisy (picks the design line)
and duplicative (same product via several collections). The real taxonomy is the theme
NAV (~5: Gifts, Flowers & Plants, RTW Wedding/Event, Workshops), which isn't a clean API
field. BUT the merchant's real product taxonomy DOES exist as collections — verified on G&T:
Bridal Bouquets, Bridesmaid Bouquets, Flower Pins & Corsages, Candles, Event Flowers…
(exactly Liam's "Wedding Flowers ▸ Bridal Bouquets"). The problem is it's buried among
~50 collections, mostly NOISE: ~30 "Flower Delivery <City>" SEO collections + operational
ones ("24 hour processing time", "Delivery only in London", "Everything Else…"). Shopify
has NO flag distinguishing the real taxonomy from the noise — the ONLY curation is the
merchant's **"Shop by product" nav menu** (in the homepage HTML).

**So Shopify grouping = CURATED-COLLECTION, driven by the product menu:**
- Primary: parse the **"Shop by product" menu** from the homepage → the curated collection
  list → each becomes a group → map to cat/subcat → pull via `/collections/<handle>/
  products.json`, **dedup by handle** (a product in several collections lands once).
- Fallback: menu not parseable → present the collection list **noise-filtered** (drop
  `flower-delivery-*`, delivery/processing/"everything-else"…) for the admin to tick.
- Per-item `product_type` + AI classify only for products in no chosen collection.
The naive "one group per URL collection" (design lines) and pure per-product classify are
BOTH wrong for Shopify; the menu-curated collections are the merchant's real taxonomy.

## Prepare is PROFILE-AWARE: report the detection + offer the grouping choice (Liam)
Prepare shows what was detected ("Shopify · 'Shop by product' menu, 6 collections · 250
products") and lets the admin CHOOSE how to group — guided-but-honest, not a black box:
- **Shopify:** (a) use the store's **product menu** collections *(default when found)* ·
  (b) **pick collections** yourself (full list, noise-filtered: drop `flower-delivery-*`,
  delivery/processing/"everything-else") · (c) **auto by product** (product_type + AI).
- **Woo:** (a) use **Store-API categories** *(clean, default)* · (b) pick categories ·
  (c) auto by product.
- **Generic/path:** today's path-hierarchy grouping (Yahire) — unchanged.
Each chosen group still maps to Ballpark cat ▸ subcat ▸ sub-sub as now (editable).

## What this resolves (one investment, several gaps)
- WooCommerce false positives + useless grouping (Adana) → real 24 products / 9 groups.
- Flat-permalink grouping collapse → grouping from `categories`, not the URL.
- Quantity pick-list / per-pack total pricing (FR-00216-adjacent) → Woo/Shopify variations
  carry per-option prices as data → the reserved Variant mechanism, populated structurally.
- Lower AI cost (structured data → little/no Haiku) and no crawl throttling.

## Where it's built
- `server/src/services/catalogue-extract.service.js` — a `detectProfile(url/html)` at the
  top of `analyse`/`startAnalyseJob`; Woo/Shopify analyse+pull branches (Store API / JSON
  clients) alongside the generic crawler; grouping from structured `categories`/collections;
  variations → options/variants (+ `flat_total` per picked pack).
- Reuses `guardedFetch`, `createForOrg`, dedup, the job engine, cost tracking as-is.

## Tracking
- Feedback: **FR-00217** (Requirement, area Catalogue).
- Related: [[FR-00216]] gap-report homes; per-pack pricing lands here via Woo/Shopify variations.
