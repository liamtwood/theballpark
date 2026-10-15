// pV2-PROJECTS-S2 (rebuild) — the project LINE layer on the freeze + overlay
// model (DATA-MODEL-REDESIGN §"Line cluster — LOCKED"). Supersedes UNIFY-01's
// single merged line-state table (projects.service.js's dormant item/estimate
// functions, which read the old price_current/flat_total/logical_line_id/
// supplier_org_id columns that no longer exist).
//
// Three tables:
//   project_items        — the STATIC frozen requirement (a faithful clone of
//                          the catalogue item at add; item_id = provenance only,
//                          NULL = custom). Agent definitional edits at S2 land
//                          HERE (the agent is still shaping the requirement; no
//                          provider has engaged).
//   project_item_quotes  — the sparse NULL-means-inherit OVERLAY, one row per
//                          (requirement × provider). At S2 there are NO engaged
//                          providers, so the only quote row that can exist is the
//                          agent's own self-quote (project_provider_id IS NULL),
//                          used solely to hold the two quote-native agent fields
//                          (quote_description — FR-00229 — and the details calc
//                          note). The estimate therefore falls through the
//                          COALESCE overlay to the frozen values.
//   project_item_matches — per-requirement AI provenance (1:1): source
//                          'catalogue' (marketplace add) / 'custom' (ad-hoc line).
//
// Current agreed form = COALESCE(quote.field, project_items.field). The pricing
// SSOT (line-pricing.js lineTotal / line-total.util.js lineTotalSql) is fed the
// RESOLVED values — the estimate aggregation runs lineTotalSql over a derived
// `pi` that resolves the overlay, so the golden contract test stays untouched.
//
// org_id is sacred: callers ALWAYS pass req.user.org_id (JWT), NEVER the body.

const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');
const { computeEstimate } = require('./estimate');
const { lineTotalSql } = require('./line-total.util');

// ── helpers ────────────────────────────────────────────────────────────────

/** First entry with is_hero, else images[0]; null when empty. items.image_url
 *  was dropped in the rebuild (0015) — the hero is derived from the images
 *  jsonb. Mirrors item.service.js heroFromImages so the cloned image matches. */
function heroFromImages(images) {
  if (!Array.isArray(images) || images.length === 0) return null;
  const hero = images.find((i) => i && i.is_hero);
  const pick = hero || images[0];
  return pick && pick.url ? pick.url : null;
}

function toPositiveInt(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** pV2-STORE-VARIANTS-UPCHARGE-01 — normalise the chosen variant to a JSON
 *  string to store, or null when there's no meaningful variant. */
function normaliseVariant(variant) {
  if (!variant) return null;
  const hasValues = variant.values && Object.keys(variant.values).length > 0;
  if (!variant.label && !variant.upcharge && !hasValues) return null;
  return JSON.stringify({
    values: variant.values ?? {},
    upcharge: Number(variant.upcharge) || 0,
    label: variant.label ?? null,
  });
}

/** Smart default quantity (pV2-QUANTITY-01, simplified for the rebuild): a pack
 *  size (serves) wins — ceil(guests / serves); else a per-guest / per-day unit
 *  seeds from the project field; else 1. The v2dev item_unit codelist carries no
 *  auto-fill mapping yet (meta is empty), so the unit→field map is explicit. */
function defaultQuantity(unit, serves, project) {
  if (serves && Number(serves) > 0) {
    const g = Number(project.guest_count);
    return Number.isFinite(g) && g >= 1 ? Math.ceil(g / Number(serves)) : 1;
  }
  if (unit === 'per_guest' || unit === 'head' || unit === 'cover') return toPositiveInt(project.guest_count);
  if (unit === 'day') return toPositiveInt(project.duration_days);
  return 1;
}

// ── the resolved overlay (COALESCE(self-quote, frozen requirement)) ──────────
// The self-quote is the agent-own row (project_provider_id IS NULL). At S2 no
// quote rows exist for pricing, so every COALESCE falls through to the frozen
// project_items values (a self-quote row only ever holds the agent's
// quote_description / details text). S3 widens this to per-provider overlays.
const RESOLVED_FROM = `
  project_items pi0
  LEFT JOIN project_item_quotes q
    ON q.project_item_id = pi0.id
   AND q.project_provider_id IS NULL
   AND q.deleted_at IS NULL`;

// The resolved column set. Exposes every field lineTotalSql reads off `pi`
// (quantity / variant / installed / install_cost / install_unit / flat_total /
// price_current / base_price) so the estimate can run the SQL mirror over it.
const RESOLVED_COLS = `
  pi0.id, pi0.project_id, pi0.project_category_id, pi0.item_id, pi0.created_at,
  (pi0.item_id IS NULL)                                   AS is_custom,
  pi0.installed                                           AS installed,
  pi0.base_price                                          AS base_price,
  COALESCE(q.name, pi0.name)                              AS name,
  COALESCE(q.description, pi0.description)                AS description,
  COALESCE(q.attributes, pi0.attributes)                  AS attributes,
  COALESCE(q.variant, pi0.variant)                        AS variant,
  COALESCE(q.image_url, pi0.image_url)                    AS image_url,
  COALESCE(q.unit, pi0.unit)                              AS unit,
  COALESCE(q.quantity, pi0.quantity)                      AS quantity,
  COALESCE(q.currency, pi0.currency)                      AS currency,
  COALESCE(q.install_description, pi0.install_description) AS install_description,
  COALESCE(q.install_cost, pi0.install_cost)              AS install_cost,
  COALESCE(q.install_unit, pi0.install_unit)              AS install_unit,
  q.price_current                                         AS price_current,
  q.price_override                                        AS flat_total,
  q.quote_description                                     AS quote_description,
  q.details                                               AS details,
  q.status                                                AS quote_status`;

// The estimate's per-line total. REUSES the pricing SSOT's SQL mirror unchanged
// (current = the negotiated per-unit from the overlay; base = the frozen
// per-unit guide; flat honours the overlay's price_override). The derived `pi`
// below supplies these as resolved columns; `i` (live catalogue item) supplies
// the volume tiers + install fallback — exactly the relations lineTotalSql reads.
const ESTIMATE_LINE_SQL = lineTotalSql({ current: 'pi.price_current', base: 'pi.base_price', flat: true });

// The project estimate cascade — ONE definition, shared by the single-project
// read (getEstimate, the detail hero) and the per-org batch (listBallparkTotals,
// the list cards) so a card's total can never drift from its hero. hard_subtotal
// = Σ the categorised (bucketed) lines, raw; fees_subtotal = Σ the uncategorised
// agent lines; line_count = how many lines (0 → the card shows "—"). Margin marks
// up hard costs only (services/estimate.js). Rates resolve from project_settings
// COALESCE the org defaults (null = inherit); budget stays agency-private. `where`
// is the only thing that differs (one project vs the org's projects).
function cascadeSql(where) {
  return `
  SELECT p.id AS project_id,
    COALESCE(ps.margin_pct,      o.default_margin_pct)      AS margin_pct,
    COALESCE(ps.contingency_pct, o.default_contingency_pct) AS contingency_pct,
    COALESCE(ps.insurance_pct,   o.default_insurance_pct)   AS insurance_pct,
    sub.hard_subtotal, sub.fees_subtotal, sub.line_count
  FROM projects p
  JOIN orgs o ON o.id = p.org_id
  LEFT JOIN project_settings ps ON ps.project_id = p.id,
  LATERAL (
    SELECT COALESCE(SUM(lt) FILTER (WHERE cat_id IS NOT NULL), 0) AS hard_subtotal,
           COALESCE(SUM(lt) FILTER (WHERE cat_id IS NULL),     0) AS fees_subtotal,
           COUNT(*) AS line_count
      FROM (
        SELECT (${ESTIMATE_LINE_SQL}) AS lt, pi.project_category_id AS cat_id
          FROM ( SELECT ${RESOLVED_COLS}
                   FROM ${RESOLVED_FROM}
                  WHERE pi0.project_id = p.id
                    AND pi0.deleted_at IS NULL
                    AND pi0.parent_id IS NULL ) pi      -- no dormant buildup children
          LEFT JOIN items i ON i.id = pi.item_id        -- live tiers + install fallback
      ) x
  ) sub
  ${where}`;
}
const ESTIMATE_SQL = cascadeSql('WHERE p.id = $1 AND p.org_id = $2 AND p.deleted_at IS NULL');
const ORG_ESTIMATE_SQL = cascadeSql('WHERE p.org_id = $1 AND p.deleted_at IS NULL');

// The QuoteLine projection. Category NAME/visuals live-join from categories via
// the project_categories bucket (project_category_id → pc → c) so a category
// rename propagates; the bucket id is the stable grouping key the client sends
// back on a custom add. The ORIGINAL library item (item_id) supplies the inbox
// brief's lib_* (S3) + the live volume tiers the pricing module needs.
const QUOTE_LINE_JOIN = `
  SELECT ${RESOLVED_COLS},
         c.name AS category_name, c.icon_name AS category_icon_name,
         i.description AS i_description,
         i.name AS lib_name, i.description AS lib_description, i.base_price AS lib_base_price,
         i.install_description AS lib_install_description, i.images AS lib_images,
         i.attributes -> 'price_tiers' AS price_tiers,
         i.install_cost AS i_install_cost, i.install_description AS i_install_description,
         i.install_unit AS i_install_unit,
         i.org_id AS supplier_id, o.name AS supplier_name, o.default_currency AS supplier_currency,
         EXISTS (SELECT 1 FROM items ci WHERE ci.parent_item_id = pi0.item_id AND ci.deleted_at IS NULL) AS has_options
    FROM ${RESOLVED_FROM}
    LEFT JOIN project_categories pc ON pc.id = pi0.project_category_id
    LEFT JOIN categories c ON c.id = pc.category_id
    LEFT JOIN items i ON i.id = pi0.item_id
    LEFT JOIN orgs o ON o.id = i.org_id`;

function toQuoteLine(row) {
  // The resolved per-unit "now": the negotiated overlay rate wins, else the
  // frozen guide base. (At S2 price_current is always null → base_price.)
  const basePrice = row.price_current != null
    ? Number(row.price_current)
    : (row.base_price == null ? null : Number(row.base_price));
  const variant =
    row.variant && (row.variant.label || row.variant.upcharge ||
      (row.variant.values && Object.keys(row.variant.values).length))
      ? row.variant
      : null;
  return {
    id: row.id, // project_items row id — the ONE key every per-line mutation uses
    itemId: row.item_id,
    isCustom: !!row.is_custom, // derived item_id IS NULL
    name: row.name,
    description: row.description ?? row.i_description ?? null,
    basePrice,
    priceTiers: row.price_tiers ?? null, // live catalogue tiers (null for custom)
    negotiated: row.price_current != null, // suppresses list tiers in the module
    flatTotal: row.flat_total == null ? null : Number(row.flat_total),
    installCost: row.install_cost != null ? Number(row.install_cost)
      : (row.i_install_cost == null ? null : Number(row.i_install_cost)),
    installDescription: row.install_description ?? row.i_install_description ?? null,
    installUnit: row.install_unit ?? row.i_install_unit ?? null,
    installed: row.installed ?? null,
    unit: row.unit,
    imageUrl: row.image_url,
    quantity: Number(row.quantity ?? 1),
    categoryId: row.project_category_id ?? null,
    categoryName: row.category_name ?? null,
    categoryIconName: row.category_icon_name || null,
    categoryCoverUrl: null, // v2dev categories carry no cover image → icon fallback
    supplierId: row.supplier_id ?? null, // the catalogue owner; engagement is S3
    supplierName: row.supplier_name ?? null,
    supplierCity: null, // orgs.city moved to the addresses slice (locality)
    supplierCurrency: row.supplier_currency ?? null,
    // S2: every line is still in the cart. The real send-state (out_for_quote /
    // quoted / booked / declined) is DERIVED from engagement + events in S3.
    status: 'to_send',
    libName: row.lib_name ?? null,
    libDescription: row.lib_description ?? null,
    libBasePrice: row.lib_base_price == null ? null : Number(row.lib_base_price),
    libServices: row.lib_install_description ?? null,
    libImageUrl: heroFromImages(row.lib_images),
    hasOptions: row.has_options ?? false,
    optionOfLineId: null, // buildup shelved
    extras: [], // buildup shelved
    components: [], // buildup shelved
    details: row.details ?? null, // quote-native (agent self-quote overlay)
    quoteDescription: row.quote_description ?? null, // FR-00229 (agent-owned)
    variant,
  };
}

/** One resolved quote line by project_items row id. Works on a pool or a
 *  transaction client (add/patch responses reuse the add's txn client). */
async function lineById(db, id) {
  const r = await db.query(`${QUOTE_LINE_JOIN} WHERE pi0.id = $1`, [id]);
  return r.rows.length ? toQuoteLine(r.rows[0]) : null;
}

// quote-native fields the agent self-quote overlay carries (patch key → column).
const SELF_QUOTE_COLS = { details: 'details', quoteDescription: 'quote_description' };

/** Upsert the agent's own self-quote overlay row (project_provider_id IS NULL)
 *  and set the given quote-native field(s). Runs on a transaction client. The
 *  overlay row's org_id = the requirement's org (never the body). */
async function upsertSelfQuote(client, projectItemId, orgId, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const existing = await client.query(
    `SELECT id FROM project_item_quotes
      WHERE project_item_id = $1 AND project_provider_id IS NULL AND deleted_at IS NULL
      FOR UPDATE`,
    [projectItemId]
  );
  if (existing.rows.length) {
    const sets = keys.map((k, i) => `${SELF_QUOTE_COLS[k]} = $${i + 2}`);
    await client.query(
      `UPDATE project_item_quotes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
      [existing.rows[0].id, ...keys.map((k) => fields[k])]
    );
  } else {
    const cols = keys.map((k) => SELF_QUOTE_COLS[k]);
    const place = keys.map((_, i) => `$${i + 3}`);
    await client.query(
      `INSERT INTO project_item_quotes (org_id, project_item_id, project_provider_id, ${cols.join(', ')})
       VALUES ($1, $2, NULL, ${place.join(', ')})`,
      [orgId, projectItemId, ...keys.map((k) => fields[k])]
    );
  }
}

/** Find (or create) the project_categories bucket for a catalogue category, so
 *  a marketplace-added line hangs off a bucket (the data-model spine) and counts
 *  as a HARD cost (margin applies). Mirrors scaffoldCategories' ON CONFLICT on
 *  the partial unique index (project_id, category_id) WHERE deleted_at IS NULL.
 *  Runs on a transaction client. Null categoryId → null (uncategorised = a fee). */
async function resolveProjectCategory(client, projectId, categoryId) {
  if (!categoryId) return null;
  // Group under the HIGHEST-LEVEL (root) category, not the leaf subcategory —
  // matches the AI create-flow buckets (scaffoldCategories' AI_TO_DB maps to
  // top-level names, parent_id IS NULL). Walk the categories tree up to the root.
  const root = await client.query(
    `WITH RECURSIVE up AS (
       SELECT id, parent_id FROM categories WHERE id = $1 AND deleted_at IS NULL
       UNION ALL
       SELECT c.id, c.parent_id FROM categories c
         JOIN up ON c.id = up.parent_id WHERE c.deleted_at IS NULL
     )
     SELECT id FROM up WHERE parent_id IS NULL LIMIT 1`,
    [categoryId]
  );
  const topId = root.rows[0]?.id ?? categoryId; // fallback: the category itself
  const found = await client.query(
    `SELECT id FROM project_categories
      WHERE project_id = $1 AND category_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [projectId, topId]
  );
  if (found.rows.length) return found.rows[0].id;
  const ins = await client.query(
    `INSERT INTO project_categories (project_id, category_id, status, sort_order)
     VALUES ($1, $2, 'draft',
       COALESCE((SELECT MAX(sort_order) + 1 FROM project_categories
                  WHERE project_id = $1 AND deleted_at IS NULL), 0))
     ON CONFLICT (project_id, category_id) WHERE deleted_at IS NULL DO NOTHING
     RETURNING id`,
    [projectId, topId]
  );
  if (ins.rows.length) return ins.rows[0].id;
  // lost the ON CONFLICT race — re-read the row the other writer created.
  const re = await client.query(
    `SELECT id FROM project_categories
      WHERE project_id = $1 AND category_id = $2 AND deleted_at IS NULL LIMIT 1`,
    [projectId, topId]
  );
  return re.rows[0]?.id ?? null;
}

// ── reads ────────────────────────────────────────────────────────────────

/** The project's quote lines (resolved frozen + overlay). Null if the project
 *  isn't the org's (→ 404). Dormant buildup children (parent_id) never list. */
async function listItems(orgId, projectId) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  const r = await pool.query(
    `${QUOTE_LINE_JOIN}
      WHERE pi0.project_id = $1 AND pi0.deleted_at IS NULL AND pi0.parent_id IS NULL
      ORDER BY c.name NULLS LAST, pi0.created_at ASC`,
    [projectId]
  );
  return r.rows.map(toQuoteLine);
}

/** The project's estimate breakdown — the SINGLE server-computed cascade the
 *  Estimate tab + marketplace rail + project card consume (never recomputed
 *  client-side). Null if the project isn't the org's (→ 404). */
async function getEstimate(orgId, projectId) {
  const r = await pool.query(ESTIMATE_SQL, [projectId, orgId]);
  if (!r.rows.length) return null;
  return estimateFromRow(r.rows[0]);
}

/** Run one cascade row through the SOW formula (the SAME call getEstimate and
 *  listBallparkTotals both use → card total == hero total by construction). */
function estimateFromRow(row) {
  return computeEstimate(row.hard_subtotal, {
    feesSubtotal: row.fees_subtotal,
    contingencyPct: row.contingency_pct,
    insurancePct: row.insurance_pct,
    marginPct: row.margin_pct,
  });
}

/** Every project in the org → its ballpark total, in ONE query (no N+1
 *  getEstimate). The value = the project's `projectTotal` (the full cascade, so
 *  it equals the detail hero exactly), or NULL when the project has no lines (the
 *  card renders "—"). Returns Map<projectId, number|null>. Consumed by
 *  projects.service `listForOrg` for the list cards. */
async function listBallparkTotals(orgId) {
  const r = await pool.query(ORG_ESTIMATE_SQL, [orgId]);
  const map = new Map();
  for (const row of r.rows) {
    map.set(row.project_id, Number(row.line_count) === 0 ? null : estimateFromRow(row).projectTotal);
  }
  return map;
}

// ── writes ─────────────────────────────────────────────────────────────────

/** Add a catalogue item to the project — a FREEZE clone of the item's full
 *  definition into project_items (item_id = provenance; immune to later
 *  catalogue edits), plus a project_item_matches provenance row (source
 *  'catalogue'). Idempotent: a live clone of the same item is returned as-is; a
 *  soft-deleted one is revived (re-cloned). Returns the line, or null if the
 *  project isn't the org's / the item isn't visible. Atomic (Rule 1). */
async function addItem(orgId, projectId, itemId, variant = null, quantity = null) {
  const variantJson = normaliseVariant(variant);
  return withTransaction(async (client) => {
    const proj = await client.query(
      `SELECT guest_count, duration_days FROM projects
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [projectId, orgId]
    );
    if (!proj.rows.length) return null;

    // Existing clone for this (project, item)? Lock it. Live → return as-is
    // (idempotent re-add); soft-deleted → revive below.
    const existing = await client.query(
      `SELECT id, deleted_at FROM project_items
        WHERE project_id = $1 AND item_id = $2 FOR UPDATE`,
      [projectId, itemId]
    );
    const live = existing.rows.find((r) => r.deleted_at === null);
    if (live) return lineById(client, live.id);

    // Snapshot the catalogue item (RLS gates visibility → 404 if not readable).
    const snap = await client.query(
      `SELECT i.name, i.description, i.attributes, i.unit, i.base_price, i.serves,
              i.install_description, i.install_cost, i.install_unit, i.images, i.category_id,
              COALESCE(i.currency, o.default_currency) AS currency
         FROM items i LEFT JOIN orgs o ON o.id = i.org_id
        WHERE i.id = $1 AND i.deleted_at IS NULL`,
      [itemId]
    );
    if (!snap.rows.length) return null;
    const s = snap.rows[0];
    const qty = quantity != null && quantity >= 1 ? Math.floor(quantity)
      : defaultQuantity(s.unit, s.serves, proj.rows[0]);
    const pcid = await resolveProjectCategory(client, projectId, s.category_id);
    const image = heroFromImages(s.images);
    const attrs = JSON.stringify(s.attributes || {});

    const dead = existing.rows.find((r) => r.deleted_at !== null);
    let rowId;
    if (dead) {
      const up = await client.query(
        `UPDATE project_items SET
           deleted_at = NULL, deleted_by = NULL, status = 'active',
           project_category_id = $2, name = $3, description = $4, attributes = $5::jsonb,
           unit = $6, currency = $7, base_price = $8,
           install_description = $9, install_cost = $10, install_unit = $11,
           image_url = $12, variant = $13::jsonb, quantity = $14, updated_at = NOW()
          WHERE id = $1 RETURNING id`,
        [dead.id, pcid, s.name, s.description, attrs, s.unit, s.currency, s.base_price,
         s.install_description, s.install_cost, s.install_unit, image, variantJson || '{}', qty]
      );
      rowId = up.rows[0].id;
    } else {
      const ins = await client.query(
        `INSERT INTO project_items
           (org_id, project_id, project_category_id, item_id, name, description, attributes,
            quantity, unit, currency, base_price, variant,
            install_description, install_cost, install_unit, image_url, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11,$12::jsonb,$13,$14,$15,$16,'active')
         RETURNING id`,
        [orgId, projectId, pcid, itemId, s.name, s.description, attrs,
         qty, s.unit, s.currency, s.base_price, variantJson || '{}',
         s.install_description, s.install_cost, s.install_unit, image]
      );
      rowId = ins.rows[0].id;
    }
    // AI provenance (1:1). A manual marketplace add = source 'catalogue'.
    await client.query(
      `INSERT INTO project_item_matches (org_id, project_item_id, source)
       VALUES ($1, $2, 'catalogue') ON CONFLICT (project_item_id) DO NOTHING`,
      [orgId, rowId]
    );
    return lineById(client, rowId);
  });
}

/** Add a custom (ad-hoc) line — a project_items row with NO catalogue backing
 *  (item_id NULL → is_custom derived). All its data lives on the row; a
 *  project_item_matches row records source 'custom'. `categoryId` is a
 *  project_categories bucket id (the group it was added under; validated to this
 *  project, else dropped to null = a fee). Returns the line, null if not the
 *  org's. Atomic (Rule 1). */
async function addCustomItem(orgId, projectId, body) {
  return withTransaction(async (client) => {
    const owns = await client.query(
      `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [projectId, orgId]
    );
    if (!owns.rows.length) return null;
    let pcid = null;
    if (body.categoryId) {
      const pc = await client.query(
        `SELECT id FROM project_categories
          WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [body.categoryId, projectId]
      );
      pcid = pc.rows[0]?.id ?? null;
    }
    const qty = Math.max(1, Math.round(Number(body.quantity) || 1));
    const ins = await client.query(
      `INSERT INTO project_items
         (org_id, project_id, project_category_id, item_id, name, description,
          base_price, unit, quantity, installed, install_cost, install_unit, status)
       VALUES ($1,$2,$3,NULL,$4,$5,$6,$7,$8,$9,$10,$11,'active')
       RETURNING id`,
      [orgId, projectId, pcid, body.name, body.description || null,
       body.cost == null ? null : Number(body.cost), body.unit || null, qty,
       body.installed == null ? false : !!body.installed,
       body.installCost == null ? null : Number(body.installCost),
       body.installUnit || null]
    );
    const rowId = ins.rows[0].id;
    await client.query(
      `INSERT INTO project_item_matches (org_id, project_item_id, source)
       VALUES ($1, $2, 'custom') ON CONFLICT (project_item_id) DO NOTHING`,
      [orgId, rowId]
    );
    return lineById(client, rowId);
  });
}

/** Set quantity and/or install choice on a line. At S2 these write the FROZEN
 *  requirement (the agent is still shaping it; no provider engaged). Returns the
 *  line, false if no such live line, null if not the org's. Single write (the
 *  UPDATE re-scopes by project_id → the ownership read can't be raced into a
 *  cross-org write; no transaction needed per Rule 1). */
async function updateItem(orgId, projectId, lineId, patch) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  const sets = [];
  const vals = [projectId, lineId];
  if (patch.quantity !== undefined) {
    vals.push(Math.max(1, Math.round(Number(patch.quantity) || 1)));
    sets.push(`quantity = $${vals.length}`);
  }
  if (patch.installed !== undefined) {
    // project_items.installed is NOT NULL (default false); the client's "reset
    // to default" (null) maps to false. See the ship report's behaviour note.
    vals.push(patch.installed == null ? false : !!patch.installed);
    sets.push(`installed = $${vals.length}`);
  }
  if (!sets.length) return false;
  const r = await pool.query(
    `UPDATE project_items SET ${sets.join(', ')}, updated_at = NOW()
      WHERE project_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING id`,
    vals
  );
  if (!r.rows.length) return false;
  return lineById(pool, r.rows[0].id);
}

/** Edit a line's free-text + agent-editable fields. Definitional fields
 *  (name/description/Services/cost/unit/category) write the FROZEN requirement;
 *  `details` is quote-native → the agent self-quote overlay. Authority = PROJECT
 *  ownership. Multi-target → withTransaction (Rule 1). Returns the line, null if
 *  not the caller's project, false if nothing to change. */
async function updateLineDetails(orgId, projectId, lineId, patch) {
  return withTransaction(async (client) => {
    const auth = await client.query(
      `SELECT pi.id, pi.org_id FROM project_items pi
         JOIN projects p ON p.id = pi.project_id
        WHERE pi.id = $1 AND pi.project_id = $2 AND pi.deleted_at IS NULL AND p.org_id = $3`,
      [lineId, projectId, orgId]
    );
    if (!auth.rows.length) return null;
    const lineOrg = auth.rows[0].org_id;

    const sets = [];
    const vals = [lineId];
    if (patch.name !== undefined)        { vals.push(patch.name);        sets.push(`name = $${vals.length}`); }
    if (patch.description !== undefined) { vals.push(patch.description); sets.push(`description = $${vals.length}`); }
    if (patch.services !== undefined)    { vals.push(patch.services);    sets.push(`install_description = $${vals.length}`); }
    if (patch.cost !== undefined)        { vals.push(patch.cost);        sets.push(`base_price = $${vals.length}`); }
    if (patch.unit !== undefined)        { vals.push(patch.unit);        sets.push(`unit = $${vals.length}`); }
    if (patch.categoryId !== undefined) {
      let pcid = null;
      if (patch.categoryId) {
        const pc = await client.query(
          `SELECT id FROM project_categories WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
          [patch.categoryId, projectId]
        );
        pcid = pc.rows[0]?.id ?? null;
      }
      vals.push(pcid);
      sets.push(`project_category_id = $${vals.length}`);
    }
    const hasDetails = patch.details !== undefined;
    if (!sets.length && !hasDetails) return false;
    if (sets.length) {
      await client.query(
        `UPDATE project_items SET ${sets.join(', ')}, updated_at = NOW()
          WHERE id = $1 AND deleted_at IS NULL`,
        vals
      );
    }
    if (hasDetails) {
      await upsertSelfQuote(client, lineId, lineOrg, { details: patch.details || null });
    }
    return lineById(client, lineId);
  });
}

/** Set the AGENT's client-facing description (FR-00229 — the one agent-owned
 *  quote field, prints on the Quote document) on any line in their own project.
 *  Authority = PROJECT ownership; writes the agent self-quote overlay
 *  (quote_description). null/'' clears it (falls back to the supplier text).
 *  Returns the line, null if the line isn't in the caller's project. */
async function setQuoteDescription(orgId, projectId, lineId, text) {
  return withTransaction(async (client) => {
    const auth = await client.query(
      `SELECT pi.id, pi.org_id FROM project_items pi
         JOIN projects p ON p.id = pi.project_id
        WHERE pi.id = $1 AND pi.project_id = $2 AND pi.deleted_at IS NULL AND p.org_id = $3`,
      [lineId, projectId, orgId]
    );
    if (!auth.rows.length) return null;
    const value = text == null || text === '' ? null : text;
    await upsertSelfQuote(client, lineId, auth.rows[0].org_id, { quoteDescription: value });
    return lineById(client, lineId);
  });
}

/** Soft-remove a line. Returns true if a row was removed, false if none, null if
 *  the project isn't the org's. Single write (re-scoped by project_id). */
async function removeItem(orgId, projectId, lineId) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  const r = await pool.query(
    `UPDATE project_items SET deleted_at = NOW()
      WHERE project_id = $1 AND id = $2 AND deleted_at IS NULL RETURNING id`,
    [projectId, lineId]
  );
  return r.rows.length > 0;
}

module.exports = {
  listItems, getEstimate, listBallparkTotals, addItem, addCustomItem,
  updateItem, updateLineDetails, setQuoteDescription, removeItem,
  lineById, toQuoteLine,
};
