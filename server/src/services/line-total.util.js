// pV2-UNIFY-01 — the ONE per-line cost formula, parametrised on the price
// column so every surface shares it:
//   • Estimate / Cart / Final Quote → base_price   (the agent's snapshot)
//   • Inbox "Original"              → price_ref     (briefed per-unit price)
//   • Inbox "Revised"              → price_current  (negotiated per-unit price)
//
// A line = price × qty, plus install when the line is installed: per_order is a
// flat charge once, percentage scales with the (price × qty) base, else per_item
// (× qty). Aliases: pi (project_items) + i (items). Callers embed the returned
// fragment inside a SELECT that joins those two tables under those aliases.
function lineTotalSql(priceExpr) {
  return `
  COALESCE(${priceExpr}, 0) * pi.quantity
  + CASE
      WHEN NOT COALESCE(pi.installed, true) OR i.install_cost IS NULL THEN 0
      WHEN i.install_unit = 'per_order'  THEN i.install_cost
      WHEN i.install_unit = 'percentage' THEN COALESCE(${priceExpr}, 0) * pi.quantity * (i.install_cost / 100.0)
      ELSE i.install_cost * pi.quantity
    END`;
}

module.exports = { lineTotalSql };
