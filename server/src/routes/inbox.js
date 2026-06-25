// pV2-INBOX-01 — gated v2 inbox routes. Mounted on the v2 router
// (`v2.use('/inbox', …)`): inherits authenticate + requireActiveMembership,
// so req.user is the verified caller and org_id is the JWT's, never the
// client's (RP-INB1). Closes the v1 /api/messages gap where the supplier
// feed trusted a ?supplier_org_id query param.

const router = require('express').Router();
const { z } = require('zod');
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

// POST /api/inbox/send — the agency fans a project's quote out to the
// picked suppliers (one thread per category × supplier). The agency org is
// the JWT caller; the service verifies it owns the project (RP-INB1).
const SendSchema = z.object({
  projectId: z.string().uuid(),
  roster: z
    .array(
      z.object({
        categoryId: z.string().uuid(),
        supplierIds: z.array(z.string().uuid()).min(1),
      })
    )
    .min(1),
});

router.post('/send', async (req, res, next) => {
  try {
    const parsed = SendSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const result = await inbox.sendOutreach({
      agencyOrgId: req.user.org_id,
      userId: req.user.id,
      projectId: parsed.data.projectId,
      roster: parsed.data.roster,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
