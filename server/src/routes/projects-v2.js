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
const { ProjectCreateSchema, ProjectUpdateSchema } = require('../schemas/project-create.schema');

// Validate the :id slot as a UUID up front (audit M1). Without this a malformed
// id reaches Postgres and surfaces as a 500 with a DB-shaped message (wrong
// status + info disclosure); now it's a clean 400.
const UUID = z.string().uuid();
router.param('id', (req, res, next, val) =>
  UUID.safeParse(val).success ? next() : res.status(400).json({ error: 'Invalid project id' })
);

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

module.exports = router;
