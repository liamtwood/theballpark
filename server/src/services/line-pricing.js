// pV2-PRICING-SSOT-01 — THE canonical per-line pricing definition (Part A).
//
// Pure, dependency-free CommonJS so ONE file serves every runtime:
//   • the server computes single-line responses from it (projects.service
//     `lineById` etc.) — require() it;
//   • the client bundles it at build time (client-v2 imports it via the
//     `@ballpark/line-pricing` tsconfig path alias; types from the sibling
//     line-pricing.d.ts). It lives under server/ so it ships with the server
//     at runtime; the client only needs it at build time (it gets inlined).
//   • the golden contract test (line-pricing.golden.test.js) runs THIS beside
//     the SQL mirror (line-total.util.js) and asserts equality.
//
// The SQL translation in line-total.util.js `lineTotalSql` is a MECHANICAL
// MIRROR of this file. Change the rule → change BOTH → the golden test proves
// parity. A comment is not a guard (WORKING_STANDARDS #1); the golden test is.
//
// Precedence for the effective per-unit price (Part A step 2). Guiding
// principle (Liam 2026-09-19): the item price — base AND tiers — is a GUIDE;
// the real price is what the supplier + agent negotiate. So a human-entered
// price always wins over the guide, and a volume tier only ever modifies the
// guide base_price — it never overrides a negotiated or briefed price:
//   priceCurrent (negotiated, inbox)   ??   priceRef (briefed, "Original")   ??
//   tierUnit(tiers, qty) (guide tier)  ??   basePrice (guide base)

/** The matching volume tier's per-unit price at this quantity, or null when
 *  there are no tiers / none match. The tier whose [min,max] band contains qty
 *  wins; max null (or '') = open top; the highest matching min wins (mirrors the
 *  SQL `ORDER BY min DESC LIMIT 1`). */
function tierUnitPrice(tiers, quantity) {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const qty = quantity == null ? 1 : Number(quantity);
  let bestPrice = null;
  let bestMin = -1;
  for (const t of tiers) {
    if (!t) continue;
    const min = t.min == null || t.min === '' ? 0 : Number(t.min);
    const max = t.max == null || t.max === '' ? null : Number(t.max);
    if (qty >= min && (max === null || qty <= max) && min > bestMin) {
      bestPrice = Number(t.price);
      bestMin = min;
    }
  }
  return bestPrice;
}

function num(v) {
  return v == null ? null : Number(v);
}

/** The effective per-unit price for a line at its current quantity (Part A
 *  step 2). See the precedence note above. */
function effectiveUnitPrice(input) {
  const current = num(input.priceCurrent);
  if (current != null) return current; // 2a — negotiated rate wins, tiers do NOT apply
  const ref = num(input.priceRef);
  if (ref != null) return ref; // 2b — briefed "Original" rate (frozen), tiers do NOT apply
  const tier = tierUnitPrice(input.priceTiers, input.quantity); // 2c — guide tier
  if (tier != null) return tier;
  const base = num(input.basePrice); // 2d — guide base
  return base == null ? 0 : base;
}

/** The full line total (Part A step 1 + 3): a `flat_total` override on a
 *  flat-honouring surface wins outright; else effectiveUnit × qty plus install
 *  on its basis (per_order flat once, percentage of the base, else per_item ×
 *  qty). `installCost`/`installUnit` must already be the resolved value
 *  (project_items override over the catalogue item — pV2-UNIFY-01). */
function lineTotal(input) {
  const qty = input.quantity == null ? 1 : Number(input.quantity);
  if (input.honourFlat && input.flatTotal != null) return Number(input.flatTotal); // step 1
  const unit = effectiveUnitPrice(input);
  const base = unit * qty;
  const installed = input.installed !== false; // null/true = on
  const ic = num(input.installCost);
  if (!installed || ic == null) return base; // not installed / no install cost
  switch (input.installUnit) {
    case 'per_order': return base + ic; // flat, once
    case 'percentage': return base + base * (ic / 100); // % of the (unit × qty) base
    default: return base + ic * qty; // per_item / null
  }
}

module.exports = { effectiveUnitPrice, lineTotal, tierUnitPrice };
