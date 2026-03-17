const router = require('express').Router();
const pool = require('../db/pool');

// GET / - list all orgs
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orgs WHERE is_active = true ORDER BY created_at DESC'
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /:id - get single org
router.get('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM orgs WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST / - create org
router.post('/', async (req, res) => {
  try {
    const {
      name, description, type, address, city, country, phone, email, website,
      logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
      default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct
    } = req.body;
    const result = await pool.query(
      `INSERT INTO orgs (
        name, description, type, address, city, country, phone, email, website,
        logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
        default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING *`,
      [
        name, description, type, address, city, country, phone, email, website,
        logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
        default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /:id - update org
router.put('/:id', async (req, res) => {
  try {
    const {
      name, description, type, address, city, country, phone, email, website,
      logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
      default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct
    } = req.body;
    const result = await pool.query(
      `UPDATE orgs SET
        name = COALESCE($1, name),
        description = COALESCE($2, description),
        type = COALESCE($3, type),
        address = COALESCE($4, address),
        city = COALESCE($5, city),
        country = COALESCE($6, country),
        phone = COALESCE($7, phone),
        email = COALESCE($8, email),
        website = COALESCE($9, website),
        logo_url = COALESCE($10, logo_url),
        subscription_tier = COALESCE($11, subscription_tier),
        balls_balance = COALESCE($12, balls_balance),
        balls_monthly_allowance = COALESCE($13, balls_monthly_allowance),
        default_vat_pct = COALESCE($14, default_vat_pct),
        vat_registered = COALESCE($15, vat_registered),
        vat_number = COALESCE($16, vat_number),
        default_margin_pct = COALESCE($17, default_margin_pct),
        default_contingency_pct = COALESCE($18, default_contingency_pct),
        updated_at = NOW()
       WHERE id = $19 RETURNING *`,
      [
        name, description, type, address, city, country, phone, email, website,
        logo_url, subscription_tier, balls_balance, balls_monthly_allowance,
        default_vat_pct, vat_registered, vat_number, default_margin_pct, default_contingency_pct,
        req.params.id
      ]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /:id - soft delete
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'UPDATE orgs SET is_active = false, updated_at = NOW() WHERE id = $1 RETURNING *',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
