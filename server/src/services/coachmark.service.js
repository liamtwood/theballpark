// Coachmarks — admin-editable help-bubble content, keyed by (page, name).
// The app RESOLVES a coachmark on render: insert-if-missing with its code
// default, then return the (possibly admin-edited) row. Ballpark admins list +
// tweak the description / toggle active. No delete surface (yet).
const pool = require('../db/pool');

const COLS = 'id, page, name, description, tail, is_active, sort_order';

/** Return the coachmark for (page, name); create it from the code default the
 *  first time it's seen. Never overwrites an existing (admin-edited) row. */
async function resolve(page, name, defaultDescription, tail) {
  const found = await pool.query(
    `SELECT ${COLS} FROM coachmarks WHERE page = $1 AND name = $2`,
    [page, name]
  );
  if (found.rows.length) return found.rows[0];
  const ins = await pool.query(
    `INSERT INTO coachmarks (page, name, description, tail)
       VALUES ($1, $2, $3, COALESCE($4, 'up'))
     ON CONFLICT (page, name) DO UPDATE SET page = EXCLUDED.page
     RETURNING ${COLS}`,
    [page, name, defaultDescription ?? null, tail ?? null]
  );
  return ins.rows[0];
}

/** All coachmarks (admin list). */
async function list() {
  const r = await pool.query(`SELECT ${COLS} FROM coachmarks ORDER BY page, sort_order, name`);
  return r.rows;
}

/** Admin edit — description / active / tail. Returns the fresh row, or null. */
async function update(id, patch) {
  const sets = ['updated_at = NOW()'];
  const vals = [];
  if (patch.description !== undefined) { vals.push(patch.description); sets.push(`description = $${vals.length}`); }
  if (patch.isActive !== undefined)   { vals.push(patch.isActive);   sets.push(`is_active = $${vals.length}`); }
  if (patch.tail !== undefined)       { vals.push(patch.tail);       sets.push(`tail = $${vals.length}`); }
  vals.push(id);
  const r = await pool.query(
    `UPDATE coachmarks SET ${sets.join(', ')} WHERE id = $${vals.length} RETURNING ${COLS}`,
    vals
  );
  return r.rows[0] ?? null;
}

module.exports = { resolve, list, update };
