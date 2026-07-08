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
  return `
  COALESCE(${priceExpr}, 0) * pi.quantity
  + CASE
      WHEN NOT COALESCE(pi.installed, true) OR ${ic} IS NULL THEN 0
      WHEN i.install_unit = 'per_order'  THEN ${ic}
      WHEN i.install_unit = 'percentage' THEN COALESCE(${priceExpr}, 0) * pi.quantity * (${ic} / 100.0)
      ELSE ${ic} * pi.quantity
    END`;
}

module.exports = { lineTotalSql };
