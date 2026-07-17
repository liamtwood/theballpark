// pV2-UNIFY-01 — the ONE per-line cost formula, parametrised on the price
// column so every surface shares it:
//   • Estimate / Cart / Final Quote → base_price   (the agent's snapshot)
//   • Inbox "Original"              → price_ref     (briefed per-unit price)
//   • Inbox "Revised"              → price_current  (negotiated per-unit price)
//
// A line = price × qty, plus install when the line is installed: per_order is a
// flat charge once, percentage scales with the (price × qty) base, else per_item
// (× qty). The install cost is negotiable per line — a `project_items` override
// wins over the catalogue `items` value (pV2-UNIFY-01 QC), mirroring how
// base_price is already snapshotted on project_items. Aliases: pi
// (project_items) + i (items). Callers embed the fragment inside a SELECT that
// joins those two tables under those aliases.
function lineTotalSql(priceExpr) {
  const ic = 'COALESCE(pi.install_cost, i.install_cost)';
  const iu = 'COALESCE(pi.install_unit, i.install_unit)';
  return `
  COALESCE(${priceExpr}, 0) * pi.quantity
  + CASE
      WHEN NOT COALESCE(pi.installed, true) OR ${ic} IS NULL THEN 0
      WHEN ${iu} = 'per_order'  THEN ${ic}
      WHEN ${iu} = 'percentage' THEN COALESCE(${priceExpr}, 0) * pi.quantity * (${ic} / 100.0)
      ELSE ${ic} * pi.quantity
    END`;
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

module.exports = { lineTotalSql, isDeclinedSql, notDeclinedSql, DECLINED_STATUS_PREFIX };
