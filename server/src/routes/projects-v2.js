// pV2-PROJECTS-01 — the v2 projects surface. Mounted on the GATED v2
// router (`v2.use('/projects-v2', …)`): inherits authenticate +
// requireActiveMembership. org_id is sacred — ALWAYS from req.user (JWT),
// NEVER the body/query.
//
// REBUILD (projects slice — STAGE 1: Create). Only the S1 surface is wired:
//   GET  /                → the caller's org's projects, as list cards
//   GET  /client-names    → distinct client names (About Project type-ahead)
//   GET  /next-ref        → the ref the next create would auto-assign
//   POST /                → create a project from an AI-parsed brief
//   GET  /:id             → one project's full detail
//   PUT  /:id             → partial update (Project Details tab)
//
// The S2/S3/S4 surface (items / estimate / components / quote-description /
// recommend / parse-intent) is DORMANT — its tables (project_items,
// project_item_quotes, messaging) aren't built yet, so those routes stay
// unwired until their slice is ported. The service still carries the dormant
// functions; they just have no route.

const router = require('express').Router();
const { z } = require('zod');
const projects = require('../services/projects.service');
const lines = require('../services/project-line.service');
const { ProjectCreateSchema, ProjectUpdateSchema } = require('../schemas/project-create.schema');
const {
  ItemAddSchema, CustomItemSchema, ItemPatchSchema, LineDetailsSchema, QuoteDescriptionSchema,
} = require('../schemas/project-line.schema');

// Validate UUID path slots up front (audit M1). Without this a malformed id
// reaches Postgres and surfaces as a 500 with a DB-shaped message (wrong status
// + info disclosure); now it's a clean 400. :lineId and :itemId are the
// project_items ROW id on the line-cluster routes (pV2-PRICING-SSOT-01 Part E).
const UUID = z.string().uuid();
const uuidParam = (label) => (req, res, next, val) =>
  UUID.safeParse(val).success ? next() : res.status(400).json({ error: `Invalid ${label}` });
router.param('id', uuidParam('project id'));
router.param('lineId', uuidParam('line id'));
router.param('itemId', uuidParam('line id'));

// GET / — org-scoped project list. org_id is sacred: JWT only.
router.get('/', async (req, res, next) => {
  try {
    res.json(await projects.listForOrg(req.user.org_id));
  } catch (err) {
    next(err);
  }
});

// GET /client-names — distinct client names this org has used (About Project
// type-ahead). Declared before /:id so it isn't captured as a project id.
router.get('/client-names', async (req, res, next) => {
  try {
    res.json(await projects.listClientNames(req.user.org_id));
  } catch (err) {
    next(err);
  }
});

// GET /next-ref — the ref the next create would auto-assign (a proposal the
// New Project form pre-fills + lets the user override). org from JWT. Declared
// before /:id so it isn't captured as a project id.
router.get('/next-ref', async (req, res, next) => {
  try {
    res.json({ ref: await projects.previewNextRef(req.user.org_id) });
  } catch (err) {
    next(err);
  }
});

// GET /my-components — pV2-BUILDUP-02 supplier component library. SHELVED
// (buildup); the Customize rail is not an S2 surface. Safe-empty so the dialog's
// type-ahead doesn't 404. Declared before /:id so it isn't captured as an id.
router.get('/my-components', (req, res) => res.json([]));

// POST / — create a project from an AI-parsed brief. org_id from JWT, NEVER
// the body; status defaults 'draft'. The service also seeds project_settings
// (all-NULL rates) + scaffolds project_categories from the parsed brief.
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

// PUT /:id — partial update (Project Details tab). org from JWT; status is a
// TEXT codelist code. 404 when the row isn't this org's.
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

// ── Line cluster (pV2-PROJECTS-S2) — freeze + overlay ────────────────────
// project_items (frozen requirement) + project_item_quotes (sparse overlay) +
// project_item_matches (AI provenance). org_id is sacred: JWT only. A service
// return of null = not this org's / not found (→ 404); false = no live line.

// GET /:id/items — the project's quote lines (resolved frozen + overlay).
router.get('/:id/items', async (req, res, next) => {
  try {
    const list = await lines.listItems(req.user.org_id, req.params.id);
    if (list === null) return res.status(404).json({ error: 'Project not found' });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /:id/estimate — the server-computed estimate cascade (the ONE formula).
router.get('/:id/estimate', async (req, res, next) => {
  try {
    const breakdown = await lines.getEstimate(req.user.org_id, req.params.id);
    if (breakdown === null) return res.status(404).json({ error: 'Project not found' });
    res.json(breakdown);
  } catch (err) {
    next(err);
  }
});

// POST /:id/items — add a catalogue item (freeze clone). Idempotent for a live
// clone; revives a soft-deleted one. Returns the resolved line.
router.post('/:id/items', async (req, res, next) => {
  try {
    const parsed = ItemAddSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const { itemId, variant, quantity } = parsed.data;
    const line = await lines.addItem(req.user.org_id, req.params.id, itemId, variant ?? null, quantity ?? null);
    if (line === null) return res.status(404).json({ error: 'Project or item not found' });
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

// POST /:id/items/custom — add an ad-hoc line (no catalogue backing).
router.post('/:id/items/custom', async (req, res, next) => {
  try {
    const parsed = CustomItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await lines.addCustomItem(req.user.org_id, req.params.id, parsed.data);
    if (line === null) return res.status(404).json({ error: 'Project not found' });
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id/items/:lineId — soft-remove a line (by project_items ROW id).
router.delete('/:id/items/:lineId', async (req, res, next) => {
  try {
    const result = await lines.removeItem(req.user.org_id, req.params.id, req.params.lineId);
    if (result === null) return res.status(404).json({ error: 'Project not found' });
    res.json({ removed: result });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:lineId — set quantity and/or install choice.
router.patch('/:id/items/:lineId', async (req, res, next) => {
  try {
    const parsed = ItemPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await lines.updateItem(req.user.org_id, req.params.id, req.params.lineId, parsed.data);
    if (line === null) return res.status(404).json({ error: 'Project not found' });
    if (line === false) return res.status(404).json({ error: 'Line not found' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:itemId/details — free-text + agent-editable line fields.
router.patch('/:id/items/:itemId/details', async (req, res, next) => {
  try {
    const parsed = LineDetailsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await lines.updateLineDetails(req.user.org_id, req.params.id, req.params.itemId, parsed.data);
    if (line === null) return res.status(404).json({ error: 'Line not found' });
    if (line === false) return res.status(400).json({ error: 'Nothing to update' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/items/:itemId/quote-description — the agent's client-facing text.
router.put('/:id/items/:itemId/quote-description', async (req, res, next) => {
  try {
    const parsed = QuoteDescriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await lines.setQuoteDescription(req.user.org_id, req.params.id, req.params.itemId, parsed.data.quoteDescription);
    if (line === null) return res.status(404).json({ error: 'Line not found' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// ── SHELVED buildup endpoints (safe empties, NOT S2) ─────────────────────
// Composition UI (Customize / Options / AI intent / recommend) is shelved
// ([[project_buildup_shelved]]); these exist only so client calls don't 404.
// They do no work — real behaviour returns in a later slice if revived.
router.get('/:id/items/:lineId/components', (req, res) =>
  res.json({ components: [], parentName: '', parentDescription: null, parentServices: null, marginPct: null, defaultMarginPct: null }));
router.post('/:id/items/:lineId/components', (req, res) => res.json([]));
router.post('/:id/items/:lineId/parse-intent', (req, res) =>
  res.json({ reply: '', actions: [], suggestions: [] }));
router.post('/:id/items/:lineId/question', (req, res) =>
  res.status(501).json({ error: 'Not available in this stage' }));
router.post('/:id/recommend', (req, res) => res.json({ categories: [], totalAdded: 0 }));

module.exports = router;
