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
        WHERE id = $1 RETURNING ref_prefix, ref_counter, name`,
      [orgId]
    );
    let ref = null;
    if (counter.rows.length) {
      const row = counter.rows[0];
      const prefix =
        (row.ref_prefix || '').trim() ||
        ((row.name || 'BP').replace(/[^A-Za-z]/g, '').slice(0, 2) || 'BP').toUpperCase();
      ref = `${prefix.toUpperCase()}-${String(row.ref_counter).padStart(3, '0')}`;
    }

    const r = await client.query(
      `INSERT INTO projects (
         org_id, name, description, event_type, event_date,
         venue_name, venue_city, guest_count, duration_days,
         tier, currency, raw_brief_text, parsed_brief_json,
         status, status_id, ref
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
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
      ]
    );
    return toCard(r.rows[0]);
  });
}

module.exports = { listForOrg, getDetail, updateDetail, create, resolveStatus, DEFAULT_STATUS, toCard };
