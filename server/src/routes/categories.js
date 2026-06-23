// v1 categories — READ-ONLY since v2.14c (2026-06-12 security fix).
//
// The write verbs (POST / PUT / PATCH / DELETE) that lived here were
// UNGATED — no auth, no permission, no validation — anyone could mutate
// or soft-delete catalogue categories (chat audit finding, pV2-MARKET-00).
// They are RETIRED, not guarded: category curation now lives on the gated
// v2 surface (routes/marketplace.js — requireActiveMembership(
// 'admin.cross_org_view') + Zod), edited at /settings/categories.
//
// Reads stay ungated for the v1 client's browse surfaces (marketplace,
// build, project tabs) until v1 retires (pV2-11).
//
// KNOWN v1 BREAKAGE (accepted — the surfaces are superseded):
//   · /ballpark-settings categories admin (create/save/delete) → v2 page
//   · category cover-image editing via image-upload-panel (PATCH path)

const router = require('express').Router();
const CategoryService = require('../services/category.service');

router.get('/', async (req, res, next) => {
  try { res.json(await CategoryService.getAll(req.query.namespace)); } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const cat = await CategoryService.getById(req.params.id);
    if (!cat) return res.status(404).json({ error: 'Not found' });
    res.json(cat);
  } catch (err) { next(err); }
});

module.exports = router;
