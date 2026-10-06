// Codelists service — the new 3-table id-keyed model (docs/CODELISTS.md v0.2).
// reference_codelists (LIST) + reference_codelist_values (VALUES, FK codelist_id)
// + reference_codelist_consumers (which columns use a list). v2dev: these live in
// the instance's OWN public schema (not a cross-env `shared` schema). Lists are
// addressed by `name`; values join via codelist_id. Response shapes are unchanged
// so the client CodelistService / dropdowns need no edits.
//
// Serves both routers: v1 ungated reads (routes/codelists.js) + the gated v2
// surface (routes/codelists-v2.js — reads any member, curation ballpark admins).

const pool = require('../db/pool');

// Join once: active values of a list, by the list's name.
const VALUES_BY_NAME = `
  SELECT v.* FROM public.reference_codelist_values v
    JOIN public.reference_codelists l ON l.id = v.codelist_id AND l.deleted_at IS NULL
   WHERE l.name = $1 AND v.deleted_at IS NULL`;

// ── v1 reads (unchanged shape — :4200 dropdowns depend on these) ────────
async function getByName(listName) {
  const result = await pool.query(`${VALUES_BY_NAME} AND v.is_active = true ORDER BY v.sort_order ASC`, [listName]);
  return result.rows;
}

async function getAll() {
  const result = await pool.query(
    `SELECT name FROM public.reference_codelists WHERE deleted_at IS NULL ORDER BY name ASC`
  );
  return result.rows.map((r) => r.name);
}

// ── v2 (RC-aware) ───────────────────────────────────────────────────────

function toValue(row, defaultCode) {
  return {
    code: row.code,
    label: row.label,
    symbol: row.symbol,
    description: null, // the redesigned values table has no description column
    sortOrder: row.sort_order === null ? null : Number(row.sort_order),
    isActive: !!row.is_active,
    isDefault: defaultCode !== undefined ? row.code === defaultCode : undefined,
    meta: row.meta ?? {},
  };
}

/** Every list + its value counts — the admin master list. */
async function lists() {
  const r = await pool.query(
    `SELECT l.name, l.description, l.is_active, l.default_code, l.type, l.family,
            COUNT(v.id) AS value_count,
            COUNT(v.id) FILTER (WHERE v.is_active) AS active_count
       FROM public.reference_codelists l
       LEFT JOIN public.reference_codelist_values v ON v.codelist_id = l.id AND v.deleted_at IS NULL
      WHERE l.deleted_at IS NULL
      GROUP BY l.id
      ORDER BY l.type ASC, l.name ASC`
  );
  return r.rows.map((row) => ({
    listName: row.name,
    description: row.description,
    isActive: !!row.is_active,
    defaultCode: row.default_code,
    type: row.type,
    family: row.family,
    valueCount: Number(row.value_count),
    activeCount: Number(row.active_count),
  }));
}

/** Active values of one list, consumer-shaped (the CodelistService read). */
async function values(listName) {
  const parent = await getParent(listName);
  if (!parent) return [];
  const r = await pool.query(`${VALUES_BY_NAME} AND v.is_active = true ORDER BY v.sort_order ASC, v.label ASC`, [listName]);
  return r.rows.map((row) => toValue(row, parent.default_code));
}

/** ALL values incl. inactive — the curation table. */
async function valuesAll(listName) {
  const parent = await getParent(listName);
  if (!parent) return [];
  const r = await pool.query(`${VALUES_BY_NAME} ORDER BY v.sort_order ASC, v.label ASC`, [listName]);
  return r.rows.map((row) => toValue(row, parent.default_code));
}

async function getParent(listName) {
  const r = await pool.query(
    `SELECT * FROM public.reference_codelists WHERE name = $1 AND deleted_at IS NULL`,
    [listName]
  );
  return r.rows[0] ?? null;
}

/** Registered consumer columns for a list (reference_codelist_consumers). */
async function consumers(listName) {
  const r = await pool.query(
    `SELECT c.consumer_table, c.consumer_column
       FROM public.reference_codelist_consumers c
       JOIN public.reference_codelists l ON l.id = c.codelist_id
      WHERE l.name = $1`,
    [listName]
  );
  return r.rows;
}

/** Rows currently using a value — the deactivation gate count, summed across
 *  ALL registered consumers (the model now allows many). Identifiers can't be
 *  parameterised, so each (table,column) is whitelisted-by-shape (Rule 8 pure fn
 *  in codelist.consumers.js). A consumer table that doesn't exist yet (its slice
 *  isn't built) is skipped, not fatal. Returns null when nothing is registered. */
const { isSafeIdentifier } = require('./codelist.consumers');

async function inUseCount(listName, code) {
  const refs = await consumers(listName);
  if (!refs.length) return null;
  let total = 0;
  let counted = false;
  for (const { consumer_table: table, consumer_column: column } of refs) {
    if (!isSafeIdentifier(table) || !isSafeIdentifier(column)) continue;
    try {
      const hasDeletedAt = await pool.query(
        `SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema() AND table_name = $1 AND column_name = 'deleted_at'`,
        [table]
      );
      const filter = hasDeletedAt.rows.length ? 'AND deleted_at IS NULL' : '';
      const r = await pool.query(`SELECT COUNT(*) AS n FROM ${table} WHERE ${column} = $1 ${filter}`, [code]);
      total += Number(r.rows[0].n);
      counted = true;
    } catch (err) {
      // Consumer table may not exist yet (its slice isn't built) — skip, logged.
      console.warn(`[codelists] inUseCount skipped ${table}.${column} for ${listName}:`, err.message);
    }
  }
  return counted ? total : null;
}

/** Add a value to a BALLPARK-type list (the only kind admins may extend). */
async function addValue(listName, data) {
  const parent = await getParent(listName);
  if (!parent) return { error: 404 };
  if (parent.type !== 'ballpark') return { error: 'system' };
  const next = await pool.query(
    `SELECT COALESCE(MAX(sort_order), 0) + 1 AS next FROM public.reference_codelist_values WHERE codelist_id = $1`,
    [parent.id]
  );
  try {
    const r = await pool.query(
      `INSERT INTO public.reference_codelist_values
         (codelist_id, code, label, symbol, sort_order, is_active, meta)
       VALUES ($1, $2, $3, $4, $5, true, $6::jsonb)
       RETURNING *`,
      [parent.id, data.code, data.label, data.symbol ?? null,
       data.sortOrder ?? next.rows[0].next, JSON.stringify(data.meta ?? {})]
    );
    return { value: toValue(r.rows[0], parent.default_code) };
  } catch (err) {
    if (err.code === '23505') return { error: 'conflict' };
    throw err;
  }
}

/** Patch a value. Deactivating the list's default is refused. */
async function patchValue(listName, code, patch) {
  const parent = await getParent(listName);
  if (!parent) return { error: 404 };
  if (patch.isActive === false && parent.default_code === code) {
    return { error: 'default' };
  }
  const map = {
    label: patch.label,
    symbol: patch.symbol,
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
  if (patch.meta !== undefined) {
    vals.push(JSON.stringify(patch.meta));
    sets.push(`meta = $${vals.length}::jsonb`);
  }
  if (!sets.length) return { error: 'empty' };
  vals.push(parent.id, code);
  const r = await pool.query(
    `UPDATE public.reference_codelist_values
        SET ${sets.join(', ')}, updated_at = NOW()
      WHERE codelist_id = $${vals.length - 1} AND code = $${vals.length} AND deleted_at IS NULL
      RETURNING *`,
    vals
  );
  if (!r.rows.length) return { error: 404 };
  return { value: toValue(r.rows[0], parent.default_code) };
}

module.exports = {
  getByName,
  getAll,
  lists,
  values,
  valuesAll,
  getParent,
  consumers,
  inUseCount,
  addValue,
  patchValue,
};
