const pool = require('../db/pool');

// v1.65cs (p0006 follow-up) — JOIN on orgs so the Inbox can render a
// supplier logo on each thread card. The supplier identity comes from
// messages.supplier_org_id; when that's NULL the thread falls back to
// the sender's user name (legacy rows). Columns:
//   supplier_name           — orgs.name when supplier_org_id is set
//   supplier_logo_url       — orgs.logo_url (square brand mark)
//   supplier_cover_url      — orgs.cover_image_url (banner fallback)
//   sender_name             — users.name (kept for legacy compat)
async function getAll(projectId) {
  let query = `
    SELECT m.*,
           u.name             AS sender_name,
           so.name             AS supplier_name,
           so.logo_url         AS supplier_logo_url,
           so.cover_image_url  AS supplier_cover_url
      FROM messages m
      LEFT JOIN users u   ON m.user_id          = u.id
      LEFT JOIN orgs  so  ON m.supplier_org_id  = so.id
     WHERE m.deleted_at IS NULL
  `;
  const params = [];
  if (projectId) { params.push(projectId); query += ` AND m.project_id = $${params.length}`; }
  query += ' ORDER BY m.created_at ASC';
  const result = await pool.query(query, params);
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM messages WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function create(data) {
  // v1.65de (p0013 §5) — accept the compose-strip extensions:
  //   tagged_item_id  — pins a bubble to a specific item (↳ crumb)
  //   next_action_by  — sets the follow-up clock on this message
  //   intro_note      — agent's intro on the first brief
  //   category_id     — supports the brief outreach flow on the
  //                      messages table directly
  const {
    project_id, user_id, supplier_org_id, estimate_item_id,
    subject, body, direction, status_id,
    tagged_item_id, next_action_by, intro_note,
    category_id, category_name, supplier_name,
  } = data;
  const result = await pool.query(
    `INSERT INTO messages
       (project_id, user_id, supplier_org_id, estimate_item_id,
        subject, body, direction, status_id,
        tagged_item_id, next_action_by, intro_note,
        category_id, category_name, supplier_name)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     RETURNING *`,
    [
      project_id, user_id, supplier_org_id, estimate_item_id,
      subject, body, direction, status_id,
      tagged_item_id || null, next_action_by || null, intro_note || null,
      category_id || null, category_name || null, supplier_name || null,
    ]
  );
  return result.rows[0];
}

async function update(id, data) {
  const { subject, body, direction, status_id, msg_status, category_id } = data;
  const result = await pool.query(
    `UPDATE messages SET
      subject = COALESCE($1, subject), body = COALESCE($2, body),
      direction = COALESCE($3, direction), status_id = COALESCE($4, status_id),
      msg_status = COALESCE($5, msg_status), category_id = COALESCE($6, category_id),
      updated_at = NOW()
     WHERE id = $7 RETURNING *`,
    [subject, body, direction, status_id, msg_status, category_id, id]
  );
  return result.rows[0] || null;
}

async function getAllByOrg(orgId) {
  // v1.65cs — supplier JOIN added so the global Inbox card renders
  // logos the same way as the project-scoped inbox.
  const result = await pool.query(
    `SELECT m.*,
            u.name             AS sender_name,
            p.name             AS project_name,
            so.name            AS supplier_name,
            so.logo_url        AS supplier_logo_url,
            so.cover_image_url AS supplier_cover_url
       FROM messages m
       LEFT JOIN users    u  ON m.user_id          = u.id
       LEFT JOIN projects p  ON m.project_id       = p.id
       LEFT JOIN orgs     so ON m.supplier_org_id  = so.id
      WHERE p.org_id = $1
        AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC`,
    [orgId]
  );
  return result.rows;
}

// v1.65ea (p0015) — supplier-side inbox feed. Returns all messages
// where this supplier_org_id is the recipient, joined with the
// sending agency's identity (so the supplier UI can render "From:
// Woodland Agency" in the thread row "From" slot). Mirrors
// getAllByOrg's shape so the client-side buildThreads() pipeline
// keeps working unchanged.
async function getAllForSupplier(supplierOrgId) {
  const result = await pool.query(
    `SELECT m.*,
            u.name             AS sender_name,
            p.name             AS project_name,
            so.name            AS supplier_name,
            so.logo_url        AS supplier_logo_url,
            so.cover_image_url AS supplier_cover_url,
            ao.id              AS agency_org_id,
            ao.name            AS agency_name,
            ao.logo_url        AS agency_logo_url,
            ao.cover_image_url AS agency_cover_url
       FROM messages m
       LEFT JOIN users    u  ON m.user_id          = u.id
       LEFT JOIN projects p  ON m.project_id       = p.id
       LEFT JOIN orgs     so ON m.supplier_org_id  = so.id
       LEFT JOIN orgs     ao ON p.org_id           = ao.id
      WHERE m.supplier_org_id = $1
        AND m.deleted_at IS NULL
      ORDER BY m.created_at ASC`,
    [supplierOrgId]
  );
  return result.rows;
}

// v1.65g0 — soft delete. Stamps deleted_at = NOW(); all list queries
// above filter on deleted_at IS NULL so deleted rows disappear from
// the conversation stream without losing the audit trail.
async function softDelete(id) {
  const result = await pool.query(
    `UPDATE messages SET deleted_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *`,
    [id]
  );
  return result.rows[0] || null;
}

module.exports = { getAll, getById, getAllByOrg, getAllForSupplier, create, update, softDelete };
