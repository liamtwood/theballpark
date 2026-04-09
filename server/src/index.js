require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

console.log('[STARTUP] APP_SCHEMA:', process.env.APP_SCHEMA || '(not set — defaults to public)');

const express = require('express');
const cors = require('cors');

const app = express();

// CORS — environment-driven origins
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(s => s.trim())
  : ['http://localhost:4200'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Services
const OrgService = require('./services/org.service');
const UserService = require('./services/user.service');
const ProjectService = require('./services/project.service');
const ItemService = require('./services/item.service');

// Convenience: get the first agency org (acts as "current org")
app.get('/api/org', async (req, res, next) => {
  try {
    const org = await OrgService.getCurrentAgency();
    if (!org) return res.status(404).json({ error: 'No agency found' });
    res.json(org);
  } catch (err) { next(err); }
});

app.put('/api/org', async (req, res, next) => {
  try {
    const org = await OrgService.getCurrentAgency();
    if (!org) return res.status(404).json({ error: 'No agency found' });
    const updated = await OrgService.update(org.id, req.body);
    res.json(updated);
  } catch (err) { next(err); }
});

// Convenience: get org balls balance
app.get('/api/org/balls-balance', async (req, res, next) => {
  try {
    const org = await OrgService.getCurrentAgency();
    res.json({ balance: org?.balls_balance || 0 });
  } catch (err) { next(err); }
});

// Convenience: get users for current org
app.get('/api/org/users', async (req, res, next) => {
  try {
    const org = await OrgService.getCurrentAgency();
    if (!org) return res.json([]);
    const users = await UserService.getByOrg(org.id);
    res.json(users);
  } catch (err) { next(err); }
});

// Convenience: get suppliers (orgs with type='supplier')
app.get('/api/suppliers', async (req, res, next) => {
  try { res.json(await OrgService.getSuppliers()); } catch (err) { next(err); }
});

// Convenience: get supplier catalogue items grouped by category
app.get('/api/suppliers/:id/catalogue', async (req, res, next) => {
  try { res.json(await OrgService.getCatalogue(req.params.id)); } catch (err) { next(err); }
});

// PATCH item images
app.patch('/api/items/:id/images', async (req, res, next) => {
  try {
    const { cover_image_url } = req.body;
    const result = await ItemService.update(req.params.id, { image_url: cover_image_url });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) { next(err); }
});

// PATCH supplier images
app.patch('/api/suppliers/:id/images', async (req, res, next) => {
  try {
    const { cover_image_url, logo_url } = req.body;
    const result = await OrgService.update(req.params.id, { cover_image_url, logo_url });
    if (!result) return res.status(404).json({ error: 'Not found' });
    res.json(result);
  } catch (err) { next(err); }
});

// Convenience: get projects for a client
app.get('/api/clients/:id/projects', async (req, res, next) => {
  try { res.json(await ProjectService.getByClient(req.params.id)); } catch (err) { next(err); }
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
app.use('/api/storage', require('./routes/storage'));
app.use('/api/favourites', require('./routes/favourites'));

// Centralised error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`Ballpark server listening on port ${PORT}`);
});
