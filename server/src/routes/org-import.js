// pV2-IMPORT-ORG-01 (BE-00127) Part B — preview API for website org extraction.
// PREVIEW ONLY — persists nothing; the client pre-fills the admin create/profile
// form and the admin saves through the existing org save. Platform-admin only.
const router = require('express').Router();
const { z } = require('zod');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const { extractOrg } = require('../services/org-import.service');

// Mounted under the v2 group (authenticate + requireActiveMembership already
// run); add the platform-admin permission — cross-org onboarding is admin-only.
router.use(requireActiveMembership('admin.cross_org_view'));

const Body = z.object({
  url: z.string().trim().url().refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) URL'),
});

/** POST /api/v2/org-import/preview { url } → { org: {field:{value,confidence}}, source }. */
router.post('/preview', async (req, res, next) => {
  const parsed = Body.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
  }
  try {
    const result = await extractOrg(parsed.data.url);
    res.json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

module.exports = router;
