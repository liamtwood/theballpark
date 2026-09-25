# pV2-STORE-VARIANTS-01 — variant-matrix capture + configurator

**Status:** Shipped (Stage 1 — server capture). Stages 2–3 below.

## Why
Variable products (a print item priced by size × sides × quantity, apparel by
size × colour, …) are common. The fast Woo pull dropped all of it: it stored only
name/price/description/image and — worse — for a variable product the slug query
returns the parent **and** a variation sharing the slug, so `arr[0]` grabbed the
**variation** (wrong price, no description, no options). Loaded items were bare.

## Model
Reuse the reserved variant-matrix tier, stored flat in `items.attributes.variants`
(no new tables). Full contract in `docs/ITEMS.md` §"Variant matrix". Key points:
- `dimensions` (picker axes, supplier order) + `combos` (flat, sparse, each priced).
- `base_price` = cheapest combo (honest "From").
- Non-varying declared attributes → Specifications group.
- Pricing SSOT: a chosen combo sets the line via `flat_total`; picker does no maths.
- Precedence: `variants` present → combo price is the line base; `options`/`price_tiers`
  don't stack on a variant product in v1.

## Stages
1. **Server capture (SHIPPED).** `processWooUrl`: pick the PARENT (never a variation);
   for `type==='variable'`, fetch all variation prices in one call
   (`?type=variation&parent=<id>&per_page=100`, paged/bounded) via
   `profiles.wooVariationPrices`, assemble via `buildWooVariants`, store
   `attributes.variants` + demote fixed attributes to `specifications`, set base_price.
   Best-effort (a failure never drops the product). Validated live against ADANA
   (30 combos, From £53, Paper Type → spec).
2. **Configurator UI (TODO).** Item view / quick-view: one selector per dimension;
   a full combo resolves to that combo's exact price ("From £X" until complete).
3. **Quote wiring (TODO).** Chosen combo flows into the negotiation line via `flat_total`.

## Files (Stage 1)
- `server/src/services/catalogue-extract/profiles.js` — `wooVariationPrices`.
- `server/src/services/catalogue-extract.service.js` — parent selection fix,
  `buildWooVariants`, wiring in `processWooUrl`.
- `docs/ITEMS.md` — contract.
