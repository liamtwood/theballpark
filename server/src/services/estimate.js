'use strict';

// Single source of truth for a project's estimate cascade — the "client total"
// (Ballpark). subtotal → +contingency → your cost → +margin → +VAT → client
// total. When a project's rate is null/unset, the house defaults apply
// (contingency 10 / margin 20 / VAT 20 — v1 recalc()).
//
// Consumed by BOTH the agent project card (projects.service `cardBallpark`)
// and the Estimate tab (projects.service `getEstimate` → GET /:id/estimate).
// The client no longer runs this math — it consumes the breakdown below — so
// the card and the Estimate tab can never drift. Keep the formula ONLY here.

const DEFAULT_CONTINGENCY_PCT = 10;
const DEFAULT_MARGIN_PCT = 20;
const DEFAULT_VAT_PCT = 20;

/** A finite numeric rate, or the house default when null/unset/NaN. */
function rateOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Run a quote subtotal through the estimate cascade.
 * @param {number} subtotal - sum of qty × base_price over the quote's items.
 * @param {{contingencyPct?: number|null, marginPct?: number|null, vatPct?: number|null}} [rates]
 * @returns the full breakdown the Estimate tab renders; the card uses `.clientTotal`.
 */
function computeEstimate(subtotal, rates = {}) {
  const sub = Number(subtotal);
  const base = Number.isFinite(sub) && sub > 0 ? sub : 0;
  const contingencyPct = rateOr(rates.contingencyPct, DEFAULT_CONTINGENCY_PCT);
  const marginPct = rateOr(rates.marginPct, DEFAULT_MARGIN_PCT);
  const vatPct = rateOr(rates.vatPct, DEFAULT_VAT_PCT);

  const contingency = base * (contingencyPct / 100);
  const ourCost = base + contingency;
  const marginAmount = ourCost * (marginPct / 100);
  const preVat = ourCost + marginAmount;
  const vatAmount = preVat * (vatPct / 100);
  const clientTotal = preVat + vatAmount;

  return {
    subtotal: base,
    contingencyPct,
    marginPct,
    vatPct,
    contingency,
    ourCost,
    marginAmount,
    vatAmount,
    clientTotal,
  };
}

module.exports = {
  computeEstimate,
  DEFAULT_CONTINGENCY_PCT,
  DEFAULT_MARGIN_PCT,
  DEFAULT_VAT_PCT,
};
