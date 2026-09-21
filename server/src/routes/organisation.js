// pV2 Profile — the signed-in org's own profile. Mounted on the GATED v2
// router (`v2.use('/organisation', …)`): GET inherits the router-level
// authenticate + requireActiveMembership (any active member reads their own
// org); PUT additionally requires org.manage_billing (org admins — it edits
// the financial defaults). Org identity is ALWAYS req.user.org_id.
// Distinct path from v1's legacy ungated /api/org (getCurrentAgency era).

const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const { OrganisationUpdateSchema } = require('../schemas/organisation.schema');
// pV2-ADMIN-ORG-PROFILE-EDIT-01 — projection/mapper/update-builder shared with
// the admin cross-org PUT (/api/admin/orgs/:id) so the field-set lives once.
const { ORG_PROFILE_SELECT: SELECT, toProfile, buildOrgUpdate } = require('../services/org-profile.util');
const { extractOrg } = require('../services/org-import.service');

// GET /api/organisation — the caller's own org profile.
router.get('/', async (req, res, next) => {
  try {
    const r = await pool.query(SELECT, [req.user.org_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Organisation not found' });
    res.json(toProfile(r.rows[0]));
  } catch (err) { next(err); }
});

// PUT /api/organisation — org admins update their own org. Partial updates
// allowed (only provided fields change); single UPDATE statement.
router.put('/', requireActiveMembership('org.manage_billing'), async (req, res, next) => {
  try {
    const parsed = OrganisationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    const { sets, vals } = buildOrgUpdate(parsed.data);
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.user.org_id);
    const r = await pool.query(
      `UPDATE orgs SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${vals.length} AND deleted_at IS NULL
        RETURNING id`,
      vals
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Organisation not found' });
    const fresh = await pool.query(SELECT, [req.user.org_id]);
    res.json(toProfile(fresh.rows[0]));
  } catch (err) { next(err); }
});

// POST /api/organisation/import-preview — SELF-serve website extraction so an
// org admin can refresh THEIR OWN profile from its website (Fetch on the Profile
// editor). Preview only — persists NOTHING; the client applies the returned
// fields and saves through the normal PUT above. Same org.manage_billing gate as
// the PUT (Fetch leads to a profile write). NOT the admin cross-org route
// (/api/v2/org-import/preview stays admin.cross_org_view) — this is own-org only.
const ImportPreviewBody = z.object({ url: z.string().trim().url() });
router.post('/import-preview', requireActiveMembership('org.manage_billing'), async (req, res, next) => {
  const parsed = ImportPreviewBody.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'A valid url is required' });
  try { res.json(await extractOrg(parsed.data.url)); } catch (err) { next(err); }
});

module.exports = router;
