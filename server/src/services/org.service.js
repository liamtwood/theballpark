const pool = require('../db/pool');

async function getAll() {
  const result = await pool.query('SELECT * FROM orgs WHERE is_active = true ORDER BY created_at DESC');
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

async function create(data) {
  const {
    name, description, type, address, city, country, phone, email, website,
    logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
    default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
    auto_publish_items
  } = data;
  const result = await pool.query(
    `INSERT INTO orgs (
      name, description, type, address, city, country, phone, email, website,
      logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
      default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
      auto_publish_items
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19) RETURNING *`,
    [name, description, type, address, city, country, phone, email, website,
     logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
     default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
     auto_publish_items ?? true]
  );
  return result.rows[0];
}

async function update(id, data) {
  const {
    name, description, type, address, city, country, phone, email, website,
    logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
    default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
    cover_image_url, image_display, auto_publish_items
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
      updated_at = NOW()
     WHERE id = $22 RETURNING *`,
    [name, description, type, address, city, country, phone, email, website,
     logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
     default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
     cover_image_url, image_display, auto_publish_items, id]
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
    LEFT JOIN items i ON i.org_id = o.id AND i.is_active = true
    WHERE o.type = 'supplier' AND o.is_active = true
    GROUP BY o.id
    ORDER BY o.name ASC
  `);
  return result.rows;
}

async function getCatalogue(supplierId) {
  const result = await pool.query(
    `SELECT i.*, c.name as category_name, c.icon as category_icon
     FROM items i LEFT JOIN categories c ON i.category_id = c.id
     WHERE i.org_id = $1 AND i.is_active = true
     ORDER BY c.sort_order ASC, i.name ASC`,
    [supplierId]
  );
  return result.rows;
}

module.exports = { getAll, getById, getCurrentAgency, create, update, softDelete, getSuppliers, getCatalogue };
