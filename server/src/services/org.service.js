const pool = require('../db/pool');

async function getAll() {
  const result = await pool.query('SELECT * FROM orgs WHERE is_active = true ORDER BY created_at DESC');
  return result.rows;
}

/** BE-00127 — admin org list: ALL orgs (incl. suspended so the admin can
 *  re-activate), excluding only hard-removed (deleted_at). v2dev: `status`
 *  replaced v1's is_active — expose a computed is_active for client compat. */
async function getAllForAdmin() {
  const result = await pool.query(
    `SELECT *, (status = 'active') AS is_active FROM orgs WHERE deleted_at IS NULL ORDER BY created_at DESC`
  );
  return result.rows;
}

async function getById(id) {
  const result = await pool.query('SELECT * FROM orgs WHERE id = $1', [id]);
  return result.rows[0] || null;
}

async function getCurrentAgency() {
  const result = await pool.query("SELECT * FROM orgs WHERE type = 'agency' AND is_active = true LIMIT 1");
  return result.rows[0] || null;
}

// v2dev: the streamlined orgs object drops v1's embedded address (→ addresses
// satellite) and subscription_tier / balls_* (→ org_subscription / org_credits).
// New orgs hang under the Ballpark root (parent_id) and start 'active'. created_by
// is stamped from the request GUC (no audit trigger on v2dev yet) — app_is_admin()
// is on for this ballpark-admin request, so orgs_self WITH CHECK permits the write.
const BALLPARK_ORG_ID = '00000000-0000-0000-0000-000000000001';
async function create(data) {
  const {
    name, description, type, phone, email, website,
    logo_url, cover_image_url, default_currency,
    default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
    auto_publish_items, company_number,
  } = data;
  const result = await pool.query(
    `INSERT INTO orgs (
      name, description, type, status, parent_id,
      phone, email, website, logo_url, cover_image_url, default_currency,
      default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
      auto_publish_items, company_number, created_by, updated_by
    ) VALUES ($1,$2,$3,'active',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,
              app_current_user_id(), app_current_user_id())
    RETURNING *, (status = 'active') AS is_active`,
    [name, description ?? null, type, BALLPARK_ORG_ID,
     phone ?? null, email || null, website || null, logo_url ?? null, cover_image_url ?? null, default_currency ?? null,
     default_vat_pct ?? null, vat_registered ?? false, vat_number ?? null,
     default_margin_pct ?? null, default_contingency_pct ?? null,
     auto_publish_items ?? true, company_number ?? null]
  );
  return result.rows[0];
}

async function update(id, data) {
  const {
    name, description, type, address, city, country, phone, email, website,
    logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
    default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
    cover_image_url, image_display, auto_publish_items,
    // v1.39: project-ref prefix lives on the org. Counter is not
    // updatable through this path — it's driven by project creates.
    ref_prefix
  } = data;
  const result = await pool.query(
    `UPDATE orgs SET
      name = COALESCE($1, name), description = COALESCE($2, description),
      type = COALESCE($3, type), address = COALESCE($4, address),
      city = COALESCE($5, city), country = COALESCE($6, country),
      phone = COALESCE($7, phone), email = COALESCE($8, email),
      website = COALESCE($9, website), logo_url = COALESCE($10, logo_url),
      subscription_tier = COALESCE($11, subscription_tier),
      balls_balance = COALESCE($12, balls_balance),
      balls_monthly_allowance = COALESCE($13, balls_monthly_allowance),
      default_vat_pct = COALESCE($14, default_vat_pct),
      vat_registered = COALESCE($15, vat_registered),
      vat_number = COALESCE($16, vat_number),
      default_margin_pct = COALESCE($17, default_margin_pct),
      default_contingency_pct = COALESCE($18, default_contingency_pct),
      cover_image_url = COALESCE($19, cover_image_url),
      image_display = COALESCE($20, image_display),
      auto_publish_items = COALESCE($21, auto_publish_items),
      ref_prefix = COALESCE($22, ref_prefix),
      updated_at = NOW()
     WHERE id = $23 RETURNING *`,
    [name, description, type, address, city, country, phone, email, website,
     logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
     default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
     cover_image_url, image_display, auto_publish_items,
     ref_prefix ? String(ref_prefix).toUpperCase() : null,
     id]
  );
  return result.rows[0] || null;
}

/** BE-00127 — approve/suspend an org. v2dev: status enum, not is_active. */
async function setActive(id, active) {
  const result = await pool.query(
    `UPDATE orgs SET status = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL
       RETURNING *, (status = 'active') AS is_active`,
    [id, active ? 'active' : 'suspended']
  );
  return result.rows[0] || null;
}

async function softDelete(id) {
  const result = await pool.query(
    'UPDATE orgs SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *', [id]
  );
  return result.rows[0] || null;
}

// Returns all supplier orgs with an array of their distinct category_ids
// so the frontend can filter by category without lazy-loading catalogue items
async function getSuppliers() {
  const result = await pool.query(`
    SELECT
      o.*,
      COALESCE(
        ARRAY_AGG(DISTINCT i.category_id) FILTER (WHERE i.category_id IS NOT NULL),
        '{}'
      ) AS category_ids,
      COUNT(i.id) FILTER (WHERE i.is_active = true) AS item_count
    FROM orgs o
    LEFT JOIN items i ON i.org_id = o.id AND i.is_active = true AND i.deleted_at IS NULL
    WHERE o.type = 'supplier' AND o.is_active = true
    GROUP BY o.id
    ORDER BY o.name ASC
  `);
  return result.rows;
}

// v1.68b — items dual-pattern: deleted_at (removed) ALWAYS excluded;
// is_active (publish/hide) excluded for public/marketplace views but RELAXED
// for the owner's own /store (includeHidden=true) so hidden items render with
// a "Hidden" badge instead of vanishing.
async function getCatalogue(supplierId, includeHidden = false) {
  const activeFilter = includeHidden ? '' : ' AND i.is_active = true';
  const result = await pool.query(
    `SELECT i.*, c.name as category_name, c.icon as category_icon,
            COALESCE((SELECT array_agg(sit.tag_id)
                        FROM supplier_item_tag sit WHERE sit.item_id = i.id), '{}') AS tag_ids
     FROM items i LEFT JOIN categories c ON i.category_id = c.id
     WHERE i.org_id = $1 AND i.deleted_at IS NULL${activeFilter}
     ORDER BY c.sort_order ASC, i.name ASC`,
    [supplierId]
  );
  return result.rows;
}

module.exports = { getAll, getAllForAdmin, getById, getCurrentAgency, create, update, setActive, softDelete, getSuppliers, getCatalogue };
