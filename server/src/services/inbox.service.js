// pV2-INBOX-01 — gated v2 inbox façade service.
//
// Threads are stored in v1's exact (project_id, supplier_org_id,
// category_id) shape (messages + message_items + decisions + events) —
// no migration, no schema change. This service is the v2 read path over
// that data; identity is ALWAYS the caller's org (RP-INB1): every query
// filters by the org_id the route reads from the JWT, never a
// client-supplied id, and there is NO ballpark cross-org override.
//
// Slice 1 (supplier entry): the projects an agency has reached out to
// THIS supplier about, shaped as the existing ProjectCard so the
// /projects?bucket=quoting screen renders them with the agency
// project-card grid (Defer 1 — a bespoke supplier card comes later).

const pool = require('../db/pool');

/** Map a supplier-projects row to the ProjectCard contract
 *  (client-v2 core/projects/project.types.ts). The reaching-out agency
 *  is the supplier's counterparty, so it lands where the agency card
 *  shows the client; the headline total is the supplier's running quote
 *  value for the project. */
function toSupplierProjectCard(row) {
  return {
    id: row.id,
    // v1 card title = event_name with a name fallback.
    name: row.event_name || row.name,
    ref: row.ref,
    status: row.status ?? 'active',
    coverUrl: row.cover_image_url,
    coverFocalX: row.cover_focal_x ?? 50,
    coverFocalY: row.cover_focal_y ?? 50,
    iconName: row.icon_name ?? null,
    iconColor: row.icon_color ?? null,
    unsplashPhotographerName: row.unsplash_photographer_name ?? null,
    unsplashPhotoUrl: row.unsplash_photo_url ?? null,
    // The agency that reached out → the cover chip (who's asking).
    clientName: row.agency_name ?? null,
    clientLogoUrl: row.agency_logo_url ?? null,
    // Supplier headline = their running quote total for this project.
    ballparkCost: row.quote_total == null ? null : Number(row.quote_total),
    currency: row.currency ?? 'GBP',
    // NOTE(pV2-INBOX-01 QC): the agency card renders this as "{n}
    // suppliers". For the supplier view it carries the count of THEIR
    // quoted items in the project — the label wants parameterising (or a
    // bespoke supplier card, Defer 1). Flagged for Liam.
    supplierCount: Number(row.item_count ?? 0),
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** Every project the caller-supplier has been messaged about, newest
 *  activity first. One row per project: the reaching-out agency, the
 *  count of the supplier's quoted items, and their running quote total.
 *  Items hang off the brief message; replies only transition them, so
 *  SUM/COUNT across the project's messages is the project total. */
async function listSupplierProjects(supplierOrgId) {
  const r = await pool.query(
    `SELECT p.id, p.name, p.event_name, p.ref, p.status,
            p.cover_image_url, p.cover_focal_x, p.cover_focal_y,
            p.icon_name, p.icon_color,
            p.unsplash_photographer_name, p.unsplash_photo_url,
            p.currency, p.created_at,
            ao.name      AS agency_name,
            ao.logo_url  AS agency_logo_url,
            MAX(m.updated_at)                  AS updated_at,
            COUNT(DISTINCT mi.id)              AS item_count,
            COALESCE(SUM(mi.price_current), 0) AS quote_total
       FROM messages m
       JOIN projects p   ON p.id  = m.project_id
       LEFT JOIN orgs ao ON ao.id = p.org_id
       LEFT JOIN message_items mi
              ON mi.message_id = m.id AND mi.deleted_at IS NULL
      WHERE m.supplier_org_id = $1
        AND m.deleted_at IS NULL
      GROUP BY p.id, ao.name, ao.logo_url
      ORDER BY MAX(m.updated_at) DESC NULLS LAST`,
    [supplierOrgId]
  );
  return r.rows.map(toSupplierProjectCard);
}

module.exports = { listSupplierProjects };
