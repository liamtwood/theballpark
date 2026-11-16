// pV2-SOW-01 (Phase 1) — gated v2 SOW routes. Mounted on the v2 router
// (`v2.use('/sow', …)`): inherits authenticate + requireActiveMembership, so
// req.user is the verified caller and org_id is the JWT's, never the client's.
//
// v1 is CONTENT-AUTHORED and BIDIRECTIONAL: whoever is a party to the engagement
// can author a SOW (org_id = caller); the counterparty reads + signs. No org_type
// gate on the routes — both directions ride the same handlers; RLS + the gated
// document_sign definer enforce who may read, edit, and sign.

const router = require('express').Router();
const { z } = require('zod');
const sow = require('../services/sow.service');

const UUID = z.string().uuid();

// An ordered narrative section the author writes the SOW into.
const Section = z.object({
  name: z.string().trim().max(200),
  content: z.string().max(20000),
  order: z.number().int().nonnegative(),
});

// POST /api/sow — create a draft SOW for an engagement (the caller is the author).
const CreateSchema = z.object({
  projectProviderId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  content: z.array(Section).optional(),
  depositPct: z.number().min(0).max(100).optional(),
});
router.post('/', async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const result = await sow.createDraft({
      orgId: req.user.org_id,
      userId: req.user.id,
      projectProviderId: parsed.data.projectProviderId,
      name: parsed.data.name,
      content: parsed.data.content,
      depositPct: parsed.data.depositPct,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/sow?projectId= — the SOWs on a project visible to the caller
// (its own + counterparty-authored on its engagements; RLS defines the set).
router.get('/', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.query.projectId || '').success) {
      return res.status(400).json({ error: 'projectId (uuid) is required' });
    }
    res.json(await sow.listForProject(req.query.projectId, req.user.org_id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/sow/:id — one SOW as a render payload (doc + parties + signatures + fee).
router.get('/:id', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    res.json(await sow.getById(req.params.id, req.user.org_id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PATCH /api/sow/:id — edit a draft (author only; RLS gives the counterparty no
// write path, and the freeze trigger rejects edits once a signature exists).
const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    content: z.array(Section).optional(),
    depositPct: z.number().min(0).max(100).optional(),
    presentation: z.record(z.string(), z.any()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'nothing to update' });
router.patch('/:id', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    res.json(await sow.updateDraft({ id: req.params.id, userId: req.user.id, ...parsed.data }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/sow/:id/sign — sign the SOW. The caller's org_type is the party role;
// document_sign re-derives + validates it. Counterparty first → counterparty_signed;
// author last → executed.
const SignSchema = z.object({
  name: z.string().trim().min(1).max(200),
  title: z.string().trim().max(200).optional(),
});
router.post('/:id/sign', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    const parsed = SignSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    res.json(await sow.sign({ id: req.params.id, orgType: req.user.org_type, name: parsed.data.name, title: parsed.data.title }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
