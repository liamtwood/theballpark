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

module.exports = router;
