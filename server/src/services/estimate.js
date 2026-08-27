'use strict';

// Single source of truth for a project's estimate cascade (pV2-BUILDUP-04 — the
// SOW model). Two subtotals go in: HARD costs (supplier category lines, raw) and
// FEES (the agent's own uncategorised lines). Then:
//   projectCosts = hardCosts × (1 + margin%)   ← margin SILENTLY marks up the
//                                                 hard-cost lines (client sees
//                                                 the uplift; the inbox keeps
//                                                 the raw supplier price)
//   coverage     = contingency% + insurance(% or £)   (of projectCosts)
//   projectTotal = projectCosts + coverage + fees      (ex-VAT)
// Margin is folded into projectCosts, never billed separately; the client-facing
// summary shows Project Costs / Project Coverage / Project Fees / Project Total.
//
// Consumed by the project card (projects.service `cardBallpark`) + the Estimate
// tab (`getEstimate`). Keep the formula ONLY here so card + tab can't drift.

const DEFAULT_CONTINGENCY_PCT = 10;
const DEFAULT_MARGIN_PCT = 20;

/** A finite numeric rate, or the house default when null/unset/NaN. */
function rateOr(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}
function nonNeg(v) {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Run the hard-costs + fees subtotals through the SOW cascade.
 * @param {number} hardSubtotal - Σ qty×price over the SUPPLIER (categorised) lines, raw.
 * @param {{feesSubtotal?, contingencyPct?, insurancePct?, insuranceAmount?, marginPct?}} [rates]
 * @returns the breakdown the Estimate tab renders; the card uses `.projectTotal`.
 */
function computeEstimate(hardSubtotal, rates = {}) {
  const rawHard = nonNeg(hardSubtotal);
  const fees = nonNeg(rates.feesSubtotal);
  const contingencyPct = rateOr(rates.contingencyPct, DEFAULT_CONTINGENCY_PCT);
  const marginPct = rateOr(rates.marginPct, DEFAULT_MARGIN_PCT);

  // Margin is baked into the displayed hard-cost lines (silent markup).
  const marginAmount = rawHard * (marginPct / 100);
  const projectCosts = rawHard + marginAmount;

  // Contingency is a % of the (marked-up) project costs. Insurance is EITHER a %
  // of project costs OR a fixed entered £ — the % wins when set, else the amount.
  const contingency = projectCosts * (contingencyPct / 100);
  const insurancePctSet = rates.insurancePct != null && Number.isFinite(Number(rates.insurancePct));
  const insurancePct = insurancePctSet ? Number(rates.insurancePct) : 0;
  const insurance = insurancePctSet ? projectCosts * (insurancePct / 100) : rateOr(rates.insuranceAmount, 0);
  const coverage = contingency + insurance;

  const projectTotal = projectCosts + coverage + fees; // ex-VAT

  return {
    hardCosts: rawHard,
    marginPct,
    marginAmount,
    projectCosts,     // displayed Project Costs (hard × (1+margin%))
    contingencyPct,
    contingency,
    insurancePct,     // >0 when insurance is a %, else 0 (fixed £ or none)
    insurance,
    coverage,         // contingency + insurance
    fees,
    projectTotal,
    // Back-compat aliases for older consumers (card + any legacy reads).
    subtotal: rawHard,
    clientTotal: projectTotal,
  };
}

module.exports = {
  computeEstimate,
  DEFAULT_CONTINGENCY_PCT,
  DEFAULT_MARGIN_PCT,
};
