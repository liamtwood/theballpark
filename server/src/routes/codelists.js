// v1 codelists — READ-ONLY since v2.18a (pV2-CODELISTS-01).
//
// The /admin write verbs (POST / PATCH / DELETE) were UNGATED — no auth,
// no permission (RP-03 class, same as categories v2.14c). RETIRED: value
// curation now lives on the gated v2 surface (routes/codelists-v2.js +
// /settings/codelists, ballpark admins). v1's remove was already a
// soft-deactivate, so no hard-DELETE precedent is lost.
//
// Reads stay ungated for the v1 client's dropdowns until v1 retires.
// KNOWN v1 BREAKAGE (accepted — superseded): the v1 ballpark-settings
// codelist editor's writes.

const router = require('express').Router();
const CodelistService = require('../services/codelist.service');

// List all distinct list_names (read).
router.get('/admin', async (req, res, next) => {
  try { res.json(await CodelistService.getAll()); } catch (err) { next(err); }
});

// Public: read a list by name (v1 dropdowns, no auth).
router.get('/:listName', async (req, res, next) => {
  try { res.json(await CodelistService.getByName(req.params.listName)); } catch (err) { next(err); }
});

module.exports = router;
