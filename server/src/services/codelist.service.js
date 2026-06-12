// Codelists service — RC/RCV since pV2-CODELISTS-01 (docs/CODELISTS.md).
// Serves BOTH routers: v1's ungated reads (routes/codelists.js — dropdowns
// on :4200 until v1 retires) and the gated v2 surface
// (routes/codelists-v2.js — reads any member, curation ballpark admins).

const pool = require('../db/pool');

// ── v1 reads (unchanged shape — :4200 dropdowns depend on these) ────────
async function getByName(listName) {
  const result = await pool.query(
    `SELECT * FROM shared.reference_codelist_values
      WHERE list_name = $1 AND is_active = true
      ORDER BY sort_order ASC`,
    [listName]
  );
  return result.rows;
}

async function getAll() {
  const result = await pool.query(
    `SELECT DISTINCT list_name FROM shared.reference_codelist_values ORDER BY list_name ASC`
  );
  return result.rows.map((r) => r.list_name);
}

// ── v2 (RC-aware) ───────────────────────────────────────────────────────

function toValue(row) {
  return {
    code: row.code,
    label: row.label,
    symbol: row.symbol,
    description: row.description,
    sortOrder: row.sort_order === null ? null : Number(row.sort_order),
    isActive: !!row.is_active,
    isDefault: !!row.is_default,
    meta: row.meta ?? {},
  };
}

/** Every parent + its value counts — the admin master list. */
async function lists() {
  const r = await pool.query(
    `SELECT c.list_name, c.description, c.is_active, c.default_code, c.type,
            c.application, c.consumer_table, c.consumer_column,
            COUNT(v.id) AS value_count,
            COUNT(v.id) FILTER (WHERE v.is_active) AS active_count
       FROM shared.reference_codelists c
       LEFT JOIN shared.reference_codelist_values v ON v.list_name = c.list_name
      GROUP BY c.list_name
      ORDER BY c.application ASC, c.list_name ASC`
  );
  return r.rows.map((row) => ({
    listName: row.list_name,
    description: row.description,
    isActive: !!row.is_active,
    defaultCode: row.default_code,
    type: row.type,
    application: row.application,
    consumerTable: row.consumer_table,
    consumerColumn: row.consumer_column,
    valueCount: Number(row.value_count),
    activeCount: Number(row.active_count),
  }));
}

/** Active values of one list, consumer-shaped (the CodelistService read). */
async function values(listName) {
  const r = await pool.query(
    `SELECT * FROM shared.reference_codelist_values
      WHERE list_name = $1 AND is_active = true
      ORDER BY sort_order ASC, label ASC`,
    [listName]
  );
  return r.rows.map(toValue);
}

/** ALL values incl. inactive — the curation table. */
async function valuesAll(listName) {
  const r = await pool.query(
    `SELECT * FROM shared.reference_codelist_values
      WHERE list_name = $1
      ORDER BY sort_order ASC, label ASC`,
    [listName]
  );
  return r.rows.map(toValue);
}

async function getParent(listName) {
  const r = await pool.query(
    `SELECT * FROM shared.reference_codelists WHERE list_name = $1`,
    [listName]
  );
  return r.rows[0] ?? null;
}

/** Rows currently using a value — the deactivation gate count. The
 *  consumer pointer comes from the PARENT ROW (trusted data), never from
 *  request input, and is double-checked against a whitelist so a bad
 *  parent row can never reach SQL identifiers (Rule 8 pure fn — lives in
 *  codelist.consumers.js so its specs run pool-free). */
const { consumerRef } = require('./codelist.consumers');

async function inUseCount(listName, code) {
  const parent = await getParent(listName);
  const ref = consumerRef(parent);
  if (!ref) return null; // no consumer pointer → no gate count available
  const [table, column] = ref.split('.');
  try {
    // Not every v1-era consumer table carries deleted_at — detect once.
    const hasDeletedAt = await pool.query(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'deleted_at'`,
      [table]
    );
    const filter = hasDeletedAt.rows.length ? 'AND deleted_at IS NULL' : '';
    const r = await pool.query(
      `SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = $1 ${filter}`,
      [code]
    );
    return Number(r.rows[0].n);
  } catch (err) {
    // Consumer table may not exist yet (e.g. messages pre-inbox-arc) —
    // a missing gate count must not break curation (logged, null).
    console.warn(`[codelists] inUseCount failed for ${ref}:`, err.message);
    return null;
  }
}

/** Add a value to a BALLPARK-type list (the only kind admins may extend —
 *  locked rule 1). Caller has already authorised. */
async function addValue(listName, data) {
  const parent = await getParent(listName);
  if (!parent) return { error: 404 };
  if (parent.type !== 'ballpark') return { error: 'system' };
  const next = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next
       FROM shared.reference_codelist_values WHERE list_name = $1`,
    [listName]
  );
  try {
    const r = await pool.query(
      `INSERT INTO shared.reference_codelist_values
         (list_name, code, label, symbol, description, sort_order, is_active, is_system, is_default)
       VALUES ($1, $2, $3, $4, $5, $6, true, false, false)
       RETURNING *`,
      [listName, data.code, data.label, data.symbol ?? null, data.description ?? null,
       data.sortOrder ?? next.rows[0].next]
    );
    return { value: toValue(r.rows[0]) };
  } catch (err) {
    if (err.code === '23505') return { error: 'conflict' };
    throw err;
  }
}

/** Patch a value (label/symbol/description/sort/isActive). Deactivating
 *  the list's default is refused — the default must stay selectable. */
async function patchValue(listName, code, patch) {
  const parent = await getParent(listName);
  if (!parent) return { error: 404 };
  if (patch.isActive === false && parent.default_code === code) {
    return { error: 'default' };
  }
  const map = {
    label: patch.label,
    symbol: patch.symbol,
    description: patch.description,
    sort_order: patch.sortOrder,
    is_active: patch.isActive,
  };
  const sets = [];
  const vals = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (!sets.length) return { error: 'empty' };
  vals.push(listName, code);
  const r = await pool.query(
    `UPDATE shared.reference_codelist_values
        SET ${sets.join(', ')}, updated_at = NOW()
      WHERE list_name = $${vals.length - 1} AND code = $${vals.length}
      RETURNING *`,
    vals
  );
  if (!r.rows.length) return { error: 404 };
  return { value: toValue(r.rows[0]) };
}

module.exports = {
  getByName,
  getAll,
  lists,
  values,
  valuesAll,
  getParent,
  inUseCount,
  addValue,
  patchValue,
};
