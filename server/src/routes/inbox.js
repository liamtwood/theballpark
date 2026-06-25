// pV2-INBOX-01 — gated v2 inbox routes. Mounted on the v2 router
// (`v2.use('/inbox', …)`): inherits authenticate + requireActiveMembership,
// so req.user is the verified caller and org_id is the JWT's, never the
// client's (RP-INB1). Closes the v1 /api/messages gap where the supplier
// feed trusted a ?supplier_org_id query param.

const router = require('express').Router();
const inbox = require('../services/inbox.service');

// GET /api/inbox/projects — the caller-supplier's quote-request projects
// (the agency reached out about them), as ProjectCard[] for the
// /projects?bucket=quoting grid. org from JWT only.
router.get('/projects', async (req, res, next) => {
  try {
    res.json(await inbox.listSupplierProjects(req.user.org_id));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
