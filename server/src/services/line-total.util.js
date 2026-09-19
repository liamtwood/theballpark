// pV2-PRICING-SSOT-01 — the set-based SQL translation of the ONE per-line
// pricing definition. This is a MECHANICAL MIRROR of shared/pricing
// (server/src/services/line-pricing.js effectiveUnitPrice/lineTotal). Do NOT
// change the rule here without changing line-pricing.js AND the golden contract
// test (line-pricing.golden.test.js), which runs both over a case matrix and
// asserts equality — that test is what keeps the two from drifting (a comment
// is not a guard, WORKING_STANDARDS #1). SQL is kept only for set-based queries
// (aggregate/sort/filter across lines); single-line responses use the module.
//
// Effective per-unit precedence (Part A step 2): a human-entered price wins over
// the guide; a volume tier only ever modifies the guide `base`:
//   current (negotiated) ?? ref (briefed/Original) ?? tierUnit(guide) ?? base
// Pass only the columns a surface has: `current`/`base` for the estimate guide,
// `current`/`ref` for the inbox revised, `ref` alone for the frozen "Original".
// Tiers are considered ONLY when `base` (the guide) is supplied — so the inbox
// and Original surfaces (price_ref/price_current human numbers) never re-tier.
//
// A line = unit × qty plus install when installed: per_order flat once,
// percentage of the (unit × qty) base, else per_item (× qty). The install
// cost/unit is negotiable per line — a `project_items` override wins over the
// catalogue `items` value (pV2-UNIFY-01 QC). Aliases: pi (project_items) + i
// (items); callers embed the fragment in a SELECT joining those under those
// aliases. `{ flat: true }` honours a negotiated FLAT total (pi.flat_total) that
// overrides the whole per-unit calc (pV2-INTENT-01) — the "Original" surface
// passes flat:false so the frozen brief keeps the plain formula.
function lineTotalSql({ current = null, ref = null, base = null, flat = false } = {}) {
  // VOLUME tiers (guide only): the tier whose [min,max] band contains
  // pi.quantity (max null/'' = open top; highest matching min wins). Read LIVE
  // from the item row (i.attributes). Included in the precedence ONLY when a
  // guide `base` is supplied.
  const tierUnit = base
    ? `(
    CASE WHEN jsonb_typeof(i.attributes -> 'price_tiers') = 'array' THEN (
      SELECT (t ->> 'price')::numeric
        FROM jsonb_array_elements(i.attributes -> 'price_tiers') t
       WHERE pi.quantity >= COALESCE(NULLIF(t ->> 'min', '')::numeric, 0)
         AND ((t ->> 'max') IS NULL OR pi.quantity <= (t ->> 'max')::numeric)
       ORDER BY COALESCE(NULLIF(t ->> 'min', '')::numeric, 0) DESC
       LIMIT 1
    ) END)`
    : null;
  const parts = [current, ref, tierUnit, base].filter(Boolean);
  const unit = parts.length > 1 ? `COALESCE(${parts.join(', ')})` : (parts[0] || '0');
  const ic = 'COALESCE(pi.install_cost, i.install_cost)';
  const iu = 'COALESCE(pi.install_unit, i.install_unit)';
  const perUnit = `
  COALESCE(${unit}, 0) * pi.quantity
  + CASE
      WHEN NOT COALESCE(pi.installed, true) OR ${ic} IS NULL THEN 0
      WHEN ${iu} = 'per_order'  THEN ${ic}
      WHEN ${iu} = 'percentage' THEN COALESCE(${unit}, 0) * pi.quantity * (${ic} / 100.0)
      ELSE ${ic} * pi.quantity
    END`;
  return flat ? `COALESCE(pi.flat_total, (${perUnit}))` : perUnit;
}

// ── The ONE "is this line declined?" rule ────────────────────────────────────
// A declined/cancelled line still LISTS (with its pill) but must not count
// toward any total, and must never win a competing-supplier pick. That rule was
// hand-typed at three SQL sites and drifted within one arc: v2.57 applied it to
// getEstimate + LIST_SELECT but not listItems, so the line list and the total
// picked different rows of the same logical line (audit 2026-07-17 B2 — the same
// class as pV2-UNIFY-01a M-2). It lives here now; every reader references it.
//
// PREFIX rule, not an explicit code list, deliberately: `quoteStatus()` collapses
// the line state for the client with `String(sentStatus).startsWith('declined')`.
// Matching on the same prefix means a new `declined_*` codelist value can't be
// picked up by one side and silently missed by the other (audit F3).
//
// NULL status = never sent = still in the cart = NOT declined (it counts). Note
// `NULL LIKE 'declined%'` is NULL, not false — hence the explicit IS NOT NULL, so
// the fragment is also safe as an ORDER BY key (NULL would sort NULLS LAST and
// push cart lines behind declined ones).
const DECLINED_STATUS_PREFIX = 'declined';

/** SQL boolean — TRUE when the line is declined/cancelled. */
function isDeclinedSql(statusCol = 'pi.status') {
  return `(${statusCol} IS NOT NULL AND ${statusCol} LIKE '${DECLINED_STATUS_PREFIX}%')`;
}

/** SQL boolean — TRUE when the line COUNTS (not declined; NULL/cart counts). */
function notDeclinedSql(statusCol = 'pi.status') {
  return `(NOT ${isDeclinedSql(statusCol)})`;
}

/** JS boolean — TRUE when a line status is declined/cancelled. Matches the SAME
 *  `declined%` prefix as isDeclinedSql so JS readers (inbox rollups) can't drift
 *  from the SQL totals when a new `declined_*` code is added (audit F3 / RP-11). */
function isDeclined(status) {
  return typeof status === 'string' && status.startsWith(DECLINED_STATUS_PREFIX);
}

module.exports = { lineTotalSql, isDeclinedSql, notDeclinedSql, isDeclined, DECLINED_STATUS_PREFIX };
