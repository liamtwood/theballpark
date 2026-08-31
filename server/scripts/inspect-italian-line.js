/** Inspect the Italian line + its per-supplier rows + children, to debug the
 *  header (priceCurrent) vs Customize (base+upgrades) mismatch. */
const pool = require('../src/db/pool');
(async () => {
  const r = await pool.query(
    `SELECT id, name, supplier_org_id, parent_id, base_price, price_current, quantity,
            install_cost, margin_pct, selection_type
       FROM project_items
      WHERE deleted_at IS NULL AND lower(name) LIKE '%italian%'
      ORDER BY parent_id NULLS FIRST, name`
  );
  for (const x of r.rows) {
    console.log(JSON.stringify({
      id: x.id.slice(0, 8), name: x.name, supplier: x.supplier_org_id ? x.supplier_org_id.slice(0,8) : null,
      parent: x.parent_id ? x.parent_id.slice(0,8) : null, base: x.base_price, current: x.price_current,
      qty: x.quantity, install: x.install_cost, margin: x.margin_pct, sel: x.selection_type,
    }));
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
