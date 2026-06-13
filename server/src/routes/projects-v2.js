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
const projects = require('../services/projects.service');

// GET / — org-scoped project list. org_id is sacred: JWT only.
router.get('/', async (req, res, next) => {
  try {
    res.json(await projects.listForOrg(req.user.org_id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
