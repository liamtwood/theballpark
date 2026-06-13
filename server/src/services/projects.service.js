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
  SELECT p.id, p.name, p.ref, p.status, p.event_type,
         p.venue_city, p.cover_image_url, p.total_ballpark_cost,
         p.currency, p.created_at,
         (SELECT COUNT(DISTINCT i.org_id)
            FROM project_items pi
            JOIN items i ON i.id = pi.item_id
           WHERE pi.project_id = p.id AND pi.deleted_at IS NULL) AS supplier_count
    FROM projects p
   WHERE p.org_id = $1 AND p.deleted_at IS NULL
   ORDER BY p.created_at DESC`;

function toCard(row) {
  return {
    id: row.id,
    name: row.name,
    ref: row.ref,
    status: row.status ?? DEFAULT_STATUS,
    eventType: row.event_type,
    venueCity: row.venue_city,
    coverUrl: row.cover_image_url,
    ballparkCost: row.total_ballpark_cost === null ? null : Number(row.total_ballpark_cost),
    currency: row.currency ?? 'GBP',
    supplierCount: Number(row.supplier_count ?? 0),
    createdAt: row.created_at,
  };
}

/** Every non-deleted project for the org, newest first, as list cards. */
async function listForOrg(orgId) {
  const r = await pool.query(LIST_SELECT, [orgId]);
  return r.rows.map(toCard);
}

module.exports = { listForOrg, resolveStatus, DEFAULT_STATUS, toCard };
