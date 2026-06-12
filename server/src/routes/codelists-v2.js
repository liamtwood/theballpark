// pV2-CODELISTS-01 — the gated v2 codelists surface. Mounted on the v2
// router (`v2.use('/codelists', …)`): reads for any active member;
// curation (add / deactivate / reactivate VALUES — never lists, never
// DELETE) for platform admins (admin.cross_org_view).
//
//   GET    /api/codelists                       → parents + counts
//   GET    /api/codelists/:list/values          → active values (+ meta)
//   GET    /api/codelists/:list/all             → incl. inactive (admins)
//   GET    /api/codelists/:list/values/:code/usage → in-use count (admins)
//   POST   /api/codelists/:list/values          → add (admins; ballpark lists only)
//   PATCH  /api/codelists/:list/values/:code    → edit / (de|re)activate (admins)
//   DELETE (anything)                           → 405, always — see below

const router = require('express').Router();
const { z } = require('zod');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const Codelists = require('../services/codelist.service');
const {
  CodelistValueCreateSchema,
  CodelistValuePatchSchema,
  ListNameSchema,
  CodeParamSchema,
} = require('../schemas/codelist-value.schema');

const admin = requireActiveMembership('admin.cross_org_view');

function parseList(req, res) {
  const list = ListNameSchema.safeParse(req.params.list);
  if (!list.success) {
    res.status(400).json({ error: 'Invalid list name' });
    return null;
  }
  return list.data;
}

router.get('/', async (req, res, next) => {
  try { res.json(await Codelists.lists()); } catch (err) { next(err); }
});

// NOTE: the single-segment GET /api/codelists/:list belongs to the v1
// router (mounted FIRST, ungated, raw rows for :4200 dropdowns) until v1
// retires — a v2 GET /:list here would be shadowed and dead. The v2
// consumer read therefore lives at /:list/values (mirrors the POST path).
router.get('/:list/values', async (req, res, next) => {
  try {
    const list = parseList(req, res);
    if (!list) return;
    res.json(await Codelists.values(list));
  } catch (err) { next(err); }
});

router.get('/:list/all', admin, async (req, res, next) => {
  try {
    const list = parseList(req, res);
    if (!list) return;
    res.json(await Codelists.valuesAll(list));
  } catch (err) { next(err); }
});

// The deactivation gate count: "N records currently use this…"
router.get('/:list/values/:code/usage', admin, async (req, res, next) => {
  try {
    const list = parseList(req, res);
    if (!list) return;
    const code = CodeParamSchema.safeParse(req.params.code);
    if (!code.success) return res.status(400).json({ error: 'Invalid code' });
    res.json({ count: await Codelists.inUseCount(list, code.data) });
  } catch (err) { next(err); }
});

router.post('/:list/values', admin, async (req, res, next) => {
  try {
    const list = parseList(req, res);
    if (!list) return;
    const parsed = CodelistValueCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    const result = await Codelists.addValue(list, parsed.data);
    if (result.error === 404) return res.status(404).json({ error: 'Codelist not found' });
    if (result.error === 'system') {
      return res.status(403).json({
        error: 'System codelists are read-only — code paths depend on their values. New values require a code change (locked rule 1, docs/CODELISTS.md).',
      });
    }
    if (result.error === 'conflict') return res.status(409).json({ error: 'Code already exists in this list' });
    res.status(201).json(result.value);
  } catch (err) { next(err); }
});

router.patch('/:list/values/:code', admin, async (req, res, next) => {
  try {
    const list = parseList(req, res);
    if (!list) return;
    const code = CodeParamSchema.safeParse(req.params.code);
    if (!code.success) return res.status(400).json({ error: 'Invalid code' });
    const parsed = CodelistValuePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    const result = await Codelists.patchValue(list, code.data, parsed.data);
    if (result.error === 404) return res.status(404).json({ error: 'Value not found' });
    if (result.error === 'default') {
      return res.status(409).json({
        error: "This value is the list's default — pick a different default before deactivating it.",
      });
    }
    res.json(result.value);
  } catch (err) { next(err); }
});

// Locked rule 2 made self-documenting at the API surface (layer 1 of 3 —
// the DB trigger and the seed assertion are the other two).
router.delete(/.*/, (req, res) => {
  res.status(405).json({
    error:
      'Codelist values are NEVER deleted: historical rows reference them; deletion orphans data, breaks audit trails and time-series reports. Deactivate instead (PATCH { "isActive": false }) — existing rows keep displaying it, new writes stop offering it. See docs/CODELISTS.md.',
  });
});

module.exports = router;
