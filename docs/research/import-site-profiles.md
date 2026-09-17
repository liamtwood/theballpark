# Import — Vendor Site Profiles

A corpus of vendor-website "profiles" for the website-as-load importer. Each
profile records **what signals the site exposes and where every field comes
from**, using the signal cascade we settled:

**Tier 0 (always):** org identity/description = the domain **prior**.
**Tier 1 (structured, high confidence):** breadcrumb → Product JSON-LD → URL path.
**Tier 2 (semantic, AI, lower confidence):** item name + description (tiebreak +
fallback when Tier 1 is thin).

Goal: after ~10 sites, cluster them into **site types** (e.g. "rich JSON-LD +
breadcrumbs", "Shopify", "bare HTML"). The importer profiles a new site on first
scan, matches a type, and applies that type's recipe — confidence scales with how
much structure the site offers.

---

## Profile template (copy per site)
- **Platform / build:** (Shopify / Woo / Wix / custom; how detected)
- **Org identity** — JSON-LD Organization? (fields); og:*; hero H1; title
  pattern; footer legal (company/VAT); contact page. → **description source**,
  **match keys**.
- **Taxonomy** — nav (top cats / subcats count); **breadcrumb?** (format); URL
  path pattern/depth; collections→tags?
- **Item** — **Product JSON-LD?** (fields); **price source** (offers vs tier
  table); tier semantics (single/volume); images (source/count); dims/specs
  (format); options/variants?; SKU?
- **Strategy** — which tiers usable; expected auto-map confidence; gotchas.

---

## #1 — Yahire  ·  https://www.yahire.com  ·  (2026-09-17)

**Platform / build:** custom (bespoke; images on `yasitebucket` S3). Well-built —
rich schema.org JSON-LD throughout.

**Org identity** — **JSON-LD `Organization`+`LocalBusiness`** (keys: name, url,
logo, image, **description**, telephone, email, priceRange, address, geo,
areaServed, sameAs, openingHoursSpecification, aggregateRating). og:* present.
Hero H1: *"London's Slickest Furniture Hire"* (great tagline). Title: `… | Yahire`.
Footer legal: **company 7602218 · VAT 131 1881 41**. Contact page: address (Unit
13 Cranford Way, London N8 9DG), phone (+44 207 112 8511), email (info@…).
- **Description source:** JSON-LD `Organization.description` (clean, org-level,
  stable) — NOT the page `meta description` (that's per-page / product copy).
- **Match keys:** domain → **company_number** (authoritative) → name.

**Taxonomy** — nav = **8 real categories** (chair, table, linen, catering-equip,
barware/mobile-bar, gazebo, barrier, accessories), **~50 subcategories**, **4
collections** (Conference/Exhibition/Lounge/Wedding = **tags**, not cats), + nav
chrome (Our Work / Why / Trade → ignore).
- **Breadcrumb: YES** — *"You are here: Chair Hire › Bar Stool Hire › item"*
  (readable labels, explicit parent). **Primary cat/subcat source.**
- **URL path:** `/cat[/subcat][/item]` (1–3 segments), slug form.
- **Collections → tags: YES** — the 4 collections + the org description's
  use-cases (weddings/conferences/exhibitions/private events).

**Item** — **Product JSON-LD: YES** (name, description, image[], brand, **sku**,
category, url, **offers**{price, priceCurrency, availability, itemCondition}).
- **Price source:** DOM **first tier** is the base; `offers.price` is the
  **floor** (on tiered items it's the cheapest tier, e.g. chiavari £2.99 vs entry
  £3.75). Single-tier items → they agree.
- **Tier semantics:** mixed — some **volume tiers** (1-49/50-99/100+), most single.
- **Images:** `product-images/` gallery, 2–4 per item (real, not thumbnails).
- **Dims/specs:** **inconsistent** — chiavari = clean H/W/D/Material list; gazebo
  = prose ("packed away 36×36×150cm"). → treat as free-text attribute, not
  structured.
- **Options/variants:** some (seat-pad colour; gazebo sides +£25) → **extras arc**.
- **SKU: YES** (numeric, JSON-LD only) → SKU-upsert viable.

**Strategy** — **Tier 1 fully available** (breadcrumb + Product JSON-LD + clean
paths) + **strong Tier-0 prior** ("furniture hire company"). → **high auto-map
confidence**, minimal admin review. Nearly everything `unit=each`.
- **Gotchas:** (1) `offers.price` = floor, use DOM first tier; (2) dims format
  varies; (3) **keyword traps** — "bar stool" under Chair Hire is **Seating**,
  not Bar & Counter Units (breadcrumb parent beats the "bar" substring); (4)
  collections would import as phantom categories if not reclassified as tags; (5)
  Stand Structure basically never applies to a hire vendor (prior rules it out).

**Example map (redlined with Liam):** gazebo → Furniture & Fixtures / Outdoor
Furniture (NOT Stand Structure); bar-stool → Furniture & Fixtures / Seating;
chair fan-out via subcat (chiavari→Seating, sofa→Lounge & Breakout,
bar-stool→Seating); catering kit → Event Accessories / Glassware-Crockery;
kitchenware → Catering / Live Cooking Stations; barriers → Health & Safety.

---

## Site types (confirmed from 3 sites)
The clustering axis that matters most is **"is there a priced catalogue?"** —
because **org-import is universal, catalogue-import is not.**

| type | example | Org JSON-LD | priced catalogue | import behaviour |
|---|---|---|---|---|
| **A — rich custom** | Yahire | Org + Product | ✅ yes | full auto (org + catalogue), breadcrumb+prior do the work |
| **B — platform** | 100 Roses (Shopify) | Org (Product on product pages) | ✅ retail | org + catalogue via **per-platform recipe** |
| **C — bespoke/portfolio** | Lou Lou (WordPress) | Org + Breadcrumb | ❌ enquiry-only | **org ONLY** — no catalogue to load; items manual |

**Key finding:** every site tested has clean **Org JSON-LD** (org-fill works
everywhere), but only A/B have a catalogue. A large slice of event vendors
(florists, designers, stylists) are **Type C** — bespoke, no priced catalogue.
This is almost certainly why existing Ballpark suppliers have thin, hand-entered
catalogues (4–12 items). **Consequence:** build org-import first (universal);
catalogue-import is A/B only, gated by **type-detection on scan** (tell the admin
"shop found → N items" vs "no catalogue → org only, add items manually"). Shopify
(Type B) is the highest-value catalogue recipe to build first.

## #2 — 100 Roses  ·  https://www.100roses.co.uk  ·  (Type B)
Shopify. Org + WebSite JSON-LD (no Product on homepage — Shopify puts it on
product pages). No breadcrumb on home. **Priced retail catalogue** (cart + £).
Org description from og: ("Luxury flowers in London…"). → catalogue-load via a
**Shopify recipe** (predictable product JSON + /products/ + /collections/ paths).

## #3 — Lou Lou Event Design  ·  https://www.louloueventdesign.com  ·  (Type C)
WordPress. Org + BreadcrumbList JSON-LD, clean org description ("Luxury wedding
and event designer… styling, florals, stationery"). **No Product schema, no cart,
no prices — enquiry-only.** → **org-import only**; there is no catalogue to load.
Items would be added manually. Represents the bespoke event-vendor majority.

## Florist corpus (candidates — fingerprint pass TBC)
100roses.co.uk (B ✓) · london.florist · floraphy.uk · graceandthorn.com ·
botaniqueworkshop.com · louloueventdesign.com (C ✓) · pulbrookandgould.co.uk ·
anomisflowers.com · rebelrebel.co.uk. Expect a B/C split (retail shops vs
bespoke/event studios).

## Existing Ballpark suppliers (thin catalogues — import candidates)
Construct & Co (10) · DAR Hire (6) · Greenhouse (8) · Illusion Design (5) · Into
the Wild Florals (5) · Press Lane Studio (12) · ProBuild Events (60) · Rocket
Food (13) · Solopress (4) · The Food Crowd (4) · Unique Venues (9) · Volta AV
(8). Mostly event vendors (construct/floral/catering/AV/venue) — many likely
Type C (bespoke), which explains the thin catalogues.

*(Add remaining sites using the template; refine per-type recipes.)*
