// pV2-PROJECTS-01 — the v2 projects surface. Mounted on the GATED v2
// router (`v2.use('/projects-v2', …)`): inherits authenticate +
// requireActiveMembership. INTERIM PATH: v1 owns the live, ungated
// /api/projects (client-angular on :4200 until pV2-11, and it trusts
// org_id from the query string — which v2 must not). v2 takes
// /api/projects-v2 now and reclaims the clean /api/projects when v1
// retires (Liam's call).
//
//   GET /api/projects-v2  → the caller's org's projects, as list cards
//                           (org from JWT, NEVER the client). Current vs
//                           Completed bucketing is client-side (status).
//
// Inside-project detail + writes land in pV2-PROJECTS-02/03.

const router = require('express').Router();
const { z } = require('zod');
const projects = require('../services/projects.service');
const { ProjectCreateSchema, ProjectUpdateSchema } = require('../schemas/project-create.schema');

// Validate every :id / :itemId slot as a UUID up front (audit M1). Without
// this a malformed id reaches Postgres and surfaces as a 500 with a DB-shaped
// message (wrong status + info disclosure); now it's a clean 400.
const UUID = z.string().uuid();
router.param('id', (req, res, next, val) =>
  UUID.safeParse(val).success ? next() : res.status(400).json({ error: 'Invalid project id' })
);
router.param('itemId', (req, res, next, val) =>
  UUID.safeParse(val).success ? next() : res.status(400).json({ error: 'Invalid item id' })
);

// GET / — org-scoped project list. org_id is sacred: JWT only.
router.get('/', async (req, res, next) => {
  try {
    res.json(await projects.listForOrg(req.user.org_id));
  } catch (err) {
    next(err);
  }
});

// POST / — create a project from an AI-parsed brief (no items). org_id
// from JWT, NEVER the body; status dual-written 'draft'.
router.post('/', async (req, res, next) => {
  try {
    const parsed = ProjectCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    res.status(201).json(await projects.create(req.user.org_id, parsed.data));
  } catch (err) {
    next(err);
  }
});

// GET /:id — one project's full detail, org-scoped (JWT). 404 if not the
// caller's org / missing / soft-deleted.
router.get('/:id', async (req, res, next) => {
  try {
    const detail = await projects.getDetail(req.user.org_id, req.params.id);
    if (!detail) return res.status(404).json({ error: 'Project not found' });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// PUT /:id — partial update (Project Details tab). org from JWT; status
// dual-written. 404 when the row isn't this org's.
router.put('/:id', async (req, res, next) => {
  try {
    const parsed = ProjectUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const detail = await projects.updateDetail(req.user.org_id, req.params.id, parsed.data);
    if (!detail) return res.status(404).json({ error: 'Project not found' });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// POST /:id/recommend — find + add recommended items from the project's
// stored brief (v1 matcher per category). org from JWT. Returns a per-
// category summary; the Estimate tab then shows the grouped quote.
router.post('/:id/recommend', async (req, res, next) => {
  try {
    const result = await projects.recommend(req.user.org_id, req.params.id);
    if (result === null) return res.status(404).json({ error: 'Project not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Project Quote (slice 2) — minimal add/remove on project_items ────────
const QuoteAddSchema = z.object({ itemId: z.string().uuid() });

// GET /:id/items — the project's quote lines.
router.get('/:id/items', async (req, res, next) => {
  try {
    const lines = await projects.listItems(req.user.org_id, req.params.id);
    if (lines === null) return res.status(404).json({ error: 'Project not found' });
    res.json(lines);
  } catch (err) {
    next(err);
  }
});

// POST /:id/items — add an item to the quote (idempotent). org from JWT.
router.post('/:id/items', async (req, res, next) => {
  try {
    const parsed = QuoteAddSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await projects.addItem(req.user.org_id, req.params.id, parsed.data.itemId);
    if (line === null) return res.status(404).json({ error: 'Project or item not found' });
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:itemId — set the line quantity (positive integer).
const QuoteQtySchema = z.object({ quantity: z.number().int().positive() });
router.patch('/:id/items/:itemId', async (req, res, next) => {
  try {
    const parsed = QuoteQtySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await projects.updateItemQuantity(
      req.user.org_id, req.params.id, req.params.itemId, parsed.data.quantity
    );
    if (line === null) return res.status(404).json({ error: 'Project not found' });
    if (line === false) return res.status(404).json({ error: 'Item not in quote' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id/items/:itemId — remove an item from the quote.
router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const result = await projects.removeItem(req.user.org_id, req.params.id, req.params.itemId);
    if (result === null) return res.status(404).json({ error: 'Project not found' });
    res.json({ removed: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
