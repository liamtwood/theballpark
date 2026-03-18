require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4200', 'https://theballpark.vercel.app', 'https://theballpark.ai', 'https://www.theballpark.ai'] }));
app.use(express.json());

// Convenience: get the first agency org (acts as "current org")
app.get('/api/org', async (req, res) => {
  try {
    const pool = require('./db/pool');
    const result = await pool.query("SELECT * FROM orgs WHERE type = 'agency' AND is_active = true LIMIT 1");
    if (!result.rows.length) return res.status(404).json({ error: 'No agency found' });
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/org', async (req, res) => {
  try {
    const pool = require('./db/pool');
    const orgResult = await pool.query("SELECT id FROM orgs WHERE type = 'agency' AND is_active = true LIMIT 1");
    if (!orgResult.rows.length) return res.status(404).json({ error: 'No agency found' });
    const orgId = orgResult.rows[0].id;
    const { name, address, default_vat_pct, default_margin_pct, default_contingency_pct } = req.body;
    const result = await pool.query(
      `UPDATE orgs SET name = COALESCE($1, name), address = COALESCE($2, address),
       default_vat_pct = COALESCE($3, default_vat_pct), default_margin_pct = COALESCE($4, default_margin_pct),
       default_contingency_pct = COALESCE($5, default_contingency_pct), updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [name, address, default_vat_pct, default_margin_pct, default_contingency_pct, orgId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convenience: get org balls balance
app.get('/api/org/balls-balance', async (req, res) => {
  try {
    const pool = require('./db/pool');
    const result = await pool.query("SELECT balls_balance FROM orgs WHERE type = 'agency' AND is_active = true LIMIT 1");
    res.json({ balance: result.rows[0]?.balls_balance || 0 });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convenience: get users for current org
app.get('/api/org/users', async (req, res) => {
  try {
    const pool = require('./db/pool');
    const orgResult = await pool.query("SELECT id FROM orgs WHERE type = 'agency' AND is_active = true LIMIT 1");
    if (!orgResult.rows.length) return res.json([]);
    const result = await pool.query(
      'SELECT * FROM users WHERE org_id = $1 AND is_active = true ORDER BY created_at DESC',
      [orgResult.rows[0].id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convenience: get suppliers (orgs with type='supplier')
app.get('/api/suppliers', async (req, res) => {
  try {
    const pool = require('./db/pool');
    const result = await pool.query("SELECT * FROM orgs WHERE type = 'supplier' AND is_active = true ORDER BY name ASC");
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convenience: get supplier catalogue items grouped by category
app.get('/api/suppliers/:id/catalogue', async (req, res) => {
  try {
    const pool = require('./db/pool');
    const result = await pool.query(
      `SELECT i.*, c.name as category_name, c.icon as category_icon
       FROM items i LEFT JOIN categories c ON i.category_id = c.id
       WHERE i.org_id = $1 AND i.is_active = true
       ORDER BY c.sort_order ASC, i.name ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Convenience: get projects for a client
app.get('/api/clients/:id/projects', async (req, res) => {
  try {
    const pool = require('./db/pool');
    const result = await pool.query(
      'SELECT * FROM projects WHERE client_id = $1 AND is_active = true ORDER BY created_at DESC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Mount routes
app.use('/api/statuses', require('./routes/statuses'));
app.use('/api/orgs', require('./routes/orgs'));
app.use('/api/users', require('./routes/users'));
app.use('/api/clients', require('./routes/clients'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/items', require('./routes/items'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/project-categories', require('./routes/projectCategories'));
app.use('/api/estimates', require('./routes/estimates'));
app.use('/api/estimate-items', require('./routes/estimateItems'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/balls-transactions', require('./routes/ballsTransactions'));
app.use('/api/ai', require('./routes/ai'));

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Ballpark server listening on port ${PORT}`);
});
