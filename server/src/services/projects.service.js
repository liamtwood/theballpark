// pV2-PROJECTS-01 — projects domain service (route handlers stay thin;
// SQL + the status dual-model live here). The v2 surface is org-scoped:
// callers ALWAYS pass req.user.org_id (never client-supplied).
//
// STATUS DUAL-MODEL (Liam, option d): projects carries both the new
// `status` codelist code (v2 reads it; <app-status-pill list="project_status">)
// AND the legacy `status_id` FK to public.statuses (v1 on :4200 reads it).
// Writers MUST set both — resolveStatus() returns the matching status_id
// for a code so create/update can dual-write. statuses.name for
// entity_type='project' is draft/active/completed/archived, 1:1 with the
// codelist, so the mapping is exact.

const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');
const taxonomy = require('./taxonomy.service');

/** The project_status codelist default — used when a code is unknown/absent. */
const DEFAULT_STATUS = 'draft';

/** code → statuses.id (entity_type='project'), memoised per process. The
 *  statuses rows are seed data — stable within a deploy. */
let statusIdCache = null;

async function statusMap() {
  if (statusIdCache) return statusIdCache;
  const r = await pool.query(
    `SELECT id, name FROM statuses WHERE entity_type = 'project' AND is_active`
  );
  statusIdCache = new Map(r.rows.map((row) => [row.name, row.id]));
  return statusIdCache;
}

/** Resolve a project_status code to { status, statusId } for dual-write.
 *  Unknown codes fall back to the codelist default. Returns statusId=null
 *  if even the default has no statuses row (degraded, but never throws —
 *  the v2 `status` column is the source of truth; status_id is v1 compat). */
async function resolveStatus(code) {
  const map = await statusMap();
  const status = map.has(code) ? code : DEFAULT_STATUS;
  return { status, statusId: map.get(status) ?? null };
}

/** Card-shaped projection for the v2 list (PROJECTS-01). org-scoped;
 *  excludes soft-deleted. Suppliers count = distinct supplier orgs across
 *  the project's quote items (correlated subquery — fine for an org's
 *  project count). */
const LIST_SELECT = `
  SELECT p.id, p.name, p.event_name, p.ref, p.status,
         p.cover_image_url, p.client_logo_url,
         p.total_client_cost, p.currency,
         p.created_at, p.updated_at,
         c.name AS client_name,
         (SELECT COUNT(DISTINCT i.org_id)
            FROM project_items pi
            JOIN items i ON i.id = pi.item_id
           WHERE pi.project_id = p.id AND pi.deleted_at IS NULL) AS supplier_count
    FROM projects p
    LEFT JOIN clients c ON c.id = p.client_id
   WHERE p.org_id = $1 AND p.deleted_at IS NULL
   ORDER BY p.created_at DESC`;

function toCard(row) {
  return {
    id: row.id,
    // v1 card title = event_name with a name fallback.
    name: row.event_name || row.name,
    ref: row.ref,
    status: row.status ?? DEFAULT_STATUS,
    coverUrl: row.cover_image_url,
    clientName: row.client_name ?? null,
    clientLogoUrl: row.client_logo_url ?? null,
    // The headline "Ballpark" total — v1 uses total_client_cost.
    ballparkCost: row.total_client_cost === null ? null : Number(row.total_client_cost),
    currency: row.currency ?? 'GBP',
    supplierCount: Number(row.supplier_count ?? 0),
    // v1 card relative-time is off updated_at (created_at fallback).
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** Every non-deleted project for the org, newest first, as list cards. */
async function listForOrg(orgId) {
  const r = await pool.query(LIST_SELECT, [orgId]);
  return r.rows.map(toCard);
}

/** The full editable detail projection (PROJECTS-02 — Project Details tab). */
function toDetail(row) {
  return {
    id: row.id,
    ref: row.ref,
    name: row.name,
    status: row.status ?? DEFAULT_STATUS,
    description: row.description,
    eventType: row.event_type,
    eventDate: row.event_date,
    venueName: row.venue_name,
    venueCity: row.venue_city,
    venueAddress: row.venue_address,
    guestCount: row.guest_count,
    durationDays: row.duration_days,
    projectBudget: row.project_budget === null ? null : Number(row.project_budget),
    currency: row.currency ?? 'GBP',
    tier: row.tier,
    // Financial defaults for the Estimate tab breakdown (v1 formula).
    defaultMarginPct: row.default_margin_pct === null ? null : Number(row.default_margin_pct),
    defaultContingencyPct: row.default_contingency_pct === null ? null : Number(row.default_contingency_pct),
    defaultVatPct: row.default_vat_pct === null ? null : Number(row.default_vat_pct),
    eventName: row.event_name,
    clientName: row.client_name ?? null,
    coverUrl: row.cover_image_url,
    totalBallparkCost: row.total_ballpark_cost === null ? null : Number(row.total_ballpark_cost),
    createdAt: row.created_at,
  };
}

/** One project by id, scoped to the org (JWT). Null when not found / not
 *  this org / soft-deleted — the route turns that into a 404. Joins the
 *  client name (read-only display in the Details tab). */
async function getDetail(orgId, id) {
  const r = await pool.query(
    `SELECT p.*, c.name AS client_name
       FROM projects p
       LEFT JOIN clients c ON c.id = p.client_id
      WHERE p.id = $1 AND p.org_id = $2 AND p.deleted_at IS NULL`,
    [id, orgId]
  );
  return r.rows.length ? toDetail(r.rows[0]) : null;
}

/** Editable columns the Project Details tab can PUT — code↔column map kept
 *  explicit so a stray body key can never reach SQL. */
const EDITABLE = {
  name: 'name',
  description: 'description',
  eventType: 'event_type',
  eventDate: 'event_date',
  venueName: 'venue_name',
  venueCity: 'venue_city',
  venueAddress: 'venue_address',
  guestCount: 'guest_count',
  durationDays: 'duration_days',
  projectBudget: 'project_budget',
  currency: 'currency',
  tier: 'tier',
  defaultMarginPct: 'default_margin_pct',
  defaultContingencyPct: 'default_contingency_pct',
  defaultVatPct: 'default_vat_pct',
};

/** Partial update, org-scoped. Status is dual-written (code + status_id)
 *  when `status` is supplied. Returns the fresh detail, or null if the
 *  row isn't this org's. */
async function updateDetail(orgId, id, patch) {
  const sets = [];
  const vals = [];
  for (const [key, col] of Object.entries(EDITABLE)) {
    if (patch[key] !== undefined) {
      vals.push(patch[key]);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (patch.status !== undefined) {
    const { status, statusId } = await resolveStatus(patch.status);
    vals.push(status);
    sets.push(`status = $${vals.length}`);
    vals.push(statusId);
    sets.push(`status_id = $${vals.length}`);
  }
  if (!sets.length) return getDetail(orgId, id);
  vals.push(id);
  vals.push(orgId);
  const r = await pool.query(
    `UPDATE projects SET ${sets.join(', ')}, updated_at = NOW()
      WHERE id = $${vals.length - 1} AND org_id = $${vals.length} AND deleted_at IS NULL
      RETURNING id`,
    vals
  );
  // Re-fetch through getDetail so the returned projection carries the
  // joined client name (RETURNING * wouldn't have it).
  return r.rows.length ? getDetail(orgId, id) : null;
}

/** Create a project from an AI-parsed brief (pV2-PROJECTS-03 scoped — no
 *  items/categories). orgId is the JWT org (never client). Atomic
 *  (Rule 1): the ref-counter bump + the insert are one transaction.
 *  Dual-writes status (codelist code) AND status_id (legacy FK) so v1
 *  stays consistent. Returns the new project's list-card shape. */
async function create(orgId, data) {
  const { status, statusId } = await resolveStatus(DEFAULT_STATUS);
  const name = (data.name && data.name.trim()) || 'Untitled project';

  return withTransaction(async (client) => {
    // Atomic ref allocation — UPDATE…RETURNING ticks the org counter and
    // hands back the prefix in one statement (no two-create race).
    const counter = await client.query(
      `UPDATE orgs SET ref_counter = COALESCE(ref_counter, 0) + 1
        WHERE id = $1
        RETURNING ref_prefix, ref_counter, name,
                  default_margin_pct, default_contingency_pct, default_vat_pct`,
      [orgId]
    );
    let ref = null;
    // Each project carries its own financial defaults, seeded from the org's
    // (Profile → Financial defaults). Falls back to the v1 house rates when
    // the org hasn't set one. Stored on the project so it can be overridden
    // per-project later without disturbing the org default or other projects.
    let marginPct = 20;
    let contingencyPct = 10;
    let vatPct = 20;
    if (counter.rows.length) {
      const row = counter.rows[0];
      const prefix =
        (row.ref_prefix || '').trim() ||
        ((row.name || 'BP').replace(/[^A-Za-z]/g, '').slice(0, 2) || 'BP').toUpperCase();
      ref = `${prefix.toUpperCase()}-${String(row.ref_counter).padStart(3, '0')}`;
      if (row.default_margin_pct !== null) marginPct = Number(row.default_margin_pct);
      if (row.default_contingency_pct !== null) contingencyPct = Number(row.default_contingency_pct);
      if (row.default_vat_pct !== null) vatPct = Number(row.default_vat_pct);
    }

    const r = await client.query(
      `INSERT INTO projects (
         org_id, name, description, event_type, event_date,
         venue_name, venue_city, guest_count, duration_days,
         tier, currency, raw_brief_text, parsed_brief_json,
         status, status_id, ref,
         default_margin_pct, default_contingency_pct, default_vat_pct
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
       RETURNING *`,
      [
        orgId,
        name,
        data.description ?? null,
        data.eventType ?? null,
        data.eventDate ?? null,
        data.venueName ?? null,
        data.venueCity ?? null,
        data.guestCount ?? null,
        data.durationDays ?? null,
        data.tier ?? null,
        data.currency ?? 'GBP',
        data.rawBriefText ?? null,
        data.parsedBrief ? JSON.stringify(data.parsedBrief) : null,
        status,
        statusId,
        ref,
        marginPct,
        contingencyPct,
        vatPct,
      ]
    );
    return toCard(r.rows[0]);
  });
}

// ── Project Quote (PROJECTS-02 slice 2) ──────────────────────────────────
// Minimal add/remove against project_items (the full QuoteService — totals,
// pricing, checkout — lands in 06f). Every op is org-scoped via a join to
// projects (the project must be the caller's, JWT org).

function toQuoteLine(row) {
  return {
    id: row.id, // project_items row id
    itemId: row.item_id,
    name: row.name,
    basePrice: row.base_price === null ? null : Number(row.base_price),
    unit: row.unit,
    imageUrl: row.image_url,
    quantity: Number(row.quantity ?? 1),
    // Category (joined via the live item) — the Estimate tab groups by it,
    // and the category card uses its cover image else its Lucide icon.
    categoryId: row.category_id ?? null,
    categoryName: row.category_name ?? null,
    categoryIconName: row.category_icon_name || null,
    categoryCoverUrl: row.category_cover_url || null, // '' → null (clean contract)
  };
}

/** The project's quote lines (snapshot fields on project_items). Returns
 *  null if the project isn't the org's (→ 404). */
async function listItems(orgId, projectId) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  const r = await pool.query(
    `SELECT pi.id, pi.item_id, pi.name, pi.base_price, pi.unit, pi.image_url, pi.quantity,
            i.category_id, c.name AS category_name,
            c.icon_name AS category_icon_name, c.cover_image_url AS category_cover_url
       FROM project_items pi
       LEFT JOIN items i ON i.id = pi.item_id
       LEFT JOIN categories c ON c.id = i.category_id
      WHERE pi.project_id = $1 AND pi.deleted_at IS NULL
      ORDER BY c.name NULLS LAST, pi.created_at ASC`,
    [projectId]
  );
  return r.rows.map(toQuoteLine);
}

/** pV2-QUANTITY-01 — smart auto-fill: the item's unit can map (via the
 *  item_unit codelist's auto_fill_field) to a project field, so adding it
 *  seeds a sensible default quantity (per-head → guest_count, per-day →
 *  duration_days). Falls back to 1 when there's no mapping or the project
 *  field is unset. Always ≥ 1. The user overrides via the qty input. */
async function defaultQuantity(client, unit, project) {
  if (!unit) return 1;
  const m = await client.query(
    `SELECT auto_fill_field FROM shared.reference_codelist_values
      WHERE list_name = 'item_unit' AND code = $1`,
    [unit]
  );
  const field = m.rows[0]?.auto_fill_field;
  if (field === 'guest_count') return toPositiveInt(project.guest_count);
  if (field === 'duration_days') return toPositiveInt(project.duration_days);
  return 1;
}
function toPositiveInt(v) {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/** Add an item to the project's quote (idempotent — a live row for the
 *  same item is reused, not duplicated). Snapshots name/price/unit/image
 *  from the catalogue item, and seeds a smart default quantity from the
 *  unit↔project-field mapping. Returns the line, or null if not the org's. */
async function addItem(orgId, projectId, itemId) {
  return withTransaction(async (client) => {
    const owns = await client.query(
      `SELECT guest_count, duration_days FROM projects
        WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
      [projectId, orgId]
    );
    if (!owns.rows.length) return null;
    const existing = await client.query(
      `SELECT id FROM project_items
        WHERE project_id = $1 AND item_id = $2 AND deleted_at IS NULL
        FOR UPDATE`,
      [projectId, itemId]
    );
    if (existing.rows.length) {
      const r = await client.query(
        `SELECT id, item_id, name, base_price, unit, image_url, quantity
           FROM project_items WHERE id = $1`,
        [existing.rows[0].id]
      );
      return toQuoteLine(r.rows[0]);
    }
    const snap = await client.query(
      `SELECT name, base_price, unit, image_url FROM items WHERE id = $1 AND deleted_at IS NULL`,
      [itemId]
    );
    if (!snap.rows.length) return null; // unknown item → 404
    const s = snap.rows[0];
    const qty = await defaultQuantity(client, s.unit, owns.rows[0]);
    const ins = await client.query(
      `INSERT INTO project_items (project_id, item_id, name, base_price, unit, image_url, quantity, selection_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'selected')
       RETURNING id, item_id, name, base_price, unit, image_url, quantity`,
      [projectId, itemId, s.name, s.base_price, s.unit, s.image_url, qty]
    );
    return toQuoteLine(ins.rows[0]);
  });
}

/** pV2-QUANTITY-01 — set the quantity on a live quote line. Returns the
 *  updated line, false if no such live line, null if not the org's. */
async function updateItemQuantity(orgId, projectId, itemId, quantity) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  const r = await pool.query(
    `UPDATE project_items SET quantity = $3
      WHERE project_id = $1 AND item_id = $2 AND deleted_at IS NULL
      RETURNING id, item_id, name, base_price, unit, image_url, quantity`,
    [projectId, itemId, quantity]
  );
  if (!r.rows.length) return false; // no live line for this item
  return toQuoteLine(r.rows[0]);
}

/** Soft-remove an item from the project's quote. Returns true if a row was
 *  removed, false if none, null if the project isn't the org's. */
async function removeItem(orgId, projectId, itemId) {
  const owns = await pool.query(
    `SELECT 1 FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!owns.rows.length) return null;
  const r = await pool.query(
    `UPDATE project_items SET deleted_at = NOW()
      WHERE project_id = $1 AND item_id = $2 AND deleted_at IS NULL
      RETURNING id`,
    [projectId, itemId]
  );
  return r.rows.length > 0;
}

// ── pV2-RECOMMEND: brief → recommended items (ported from v1) ─────────────
// The AI parse-brief returns category slugs; map them to the DB catalogue
// category NAMES (v1's AI_TO_DB), then run the v1 matchItems matcher per
// category and add its picks to the project's quote. The Estimate tab then
// displays them grouped by category — no separate "ballpark" screen needed.
const AI_TO_DB = {
  'set-build': 'Stand Structure',
  print: 'Graphics & Signage',
  av: 'AV & Technology',
  floral: 'Florals',
  venues: 'Venue',
  catering: 'Catering',
  photography: 'Photography',
  staffing: 'Staffing',
  'h-and-s': 'Health & Safety',
  furniture: 'Furniture & Fixtures',
  logistics: 'Logistics & Transport',
  entertainment: 'Entertainment',
  lighting: 'Lighting',
};

/** A starting set, not the whole catalogue — the human curates on the
 *  Estimate/Marketplace. Top N matched items (score-sorted) per category. */
const RECOMMEND_PER_CATEGORY = 5;

/** LOW end of a budget band (v1 lowOfBand) — "£15k–£20k" → 15000; null when
 *  unknown. Keeps the per-category budget conservative for the matcher. */
function lowOfBand(s) {
  if (!s) return null;
  const norm = String(s).replace(/[£,]/g, '').replace(/–|—/g, '-');
  if (/unknown|tbc/i.test(norm)) return null;
  const range = norm.match(/(\d+(?:\.\d+)?)\s*([kKmM])?\s*-\s*(\d+(?:\.\d+)?)\s*([kKmM])?/);
  const toNum = (n, sfx) => {
    const base = parseFloat(n);
    if ((sfx || '').toLowerCase() === 'k') return base * 1000;
    if ((sfx || '').toLowerCase() === 'm') return base * 1_000_000;
    return base;
  };
  if (range) return Math.round(toNum(range[1], range[2]));
  const single = norm.match(/(\d+(?:\.\d+)?)\s*([kKmM])?/);
  return single ? Math.round(toNum(single[1], single[2])) : null;
}

/** Recommend + add items for a project from its stored parsed brief. For each
 *  briefed category: resolve the DB category, run matchItems, add the top
 *  picks to the quote (via addItem — idempotent, snapshots + smart-fill qty).
 *  Returns a per-category summary. null if the project isn't the org's. */
async function recommend(orgId, projectId) {
  const pr = await pool.query(
    `SELECT parsed_brief_json FROM projects
      WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, orgId]
  );
  if (!pr.rows.length) return null;
  const brief = pr.rows[0].parsed_brief_json;
  const cats = Array.isArray(brief?.categories) ? brief.categories : [];

  const results = [];
  let totalAdded = 0;
  for (const c of cats) {
    const dbName = AI_TO_DB[c.categoryId];
    if (!dbName) continue;
    const catRow = await pool.query(
      `SELECT id FROM categories
        WHERE name = $1 AND namespace = 'catalogue' AND parent_id IS NULL
        LIMIT 1`,
      [dbName]
    );
    if (!catRow.rows.length) continue;
    const categoryId = catRow.rows[0].id;
    const catBrief = (c.oneLiner || c.categoryLabel || dbName).trim();
    const budget = lowOfBand(c.budgetEstimate);

    let match;
    try {
      match = await taxonomy.matchItems(catBrief, categoryId, budget, projectId);
    } catch (err) {
      results.push({ category: dbName, added: 0, error: err.message });
      continue;
    }
    const picks = (match.matched_items || []).slice(0, RECOMMEND_PER_CATEGORY);
    let added = 0;
    for (const it of picks) {
      const line = await addItem(orgId, projectId, it.item_id);
      if (line) added += 1;
    }
    totalAdded += added;
    results.push({ category: dbName, added });
  }
  return { categories: results, totalAdded };
}

module.exports = {
  listForOrg, getDetail, updateDetail, create,
  listItems, addItem, removeItem, updateItemQuantity, recommend,
  resolveStatus, DEFAULT_STATUS, toCard,
};
