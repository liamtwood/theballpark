// BE-00127 slice 2 — admin Orgs management. Mounted under the /api/admin gate
// (authenticate + requireActiveMembership('admin.cross_org_view')), which sets
// the app.is_admin GUC so RLS (orgs_self) permits cross-org list/read/create.
// Approve/suspend (is_active toggle) is a held follow-up (slice 2b) pending
// Liam's mechanism call.
const router = require('express').Router();
const { z } = require('zod');
const OrgService = require('../services/org.service');

const CreateBody = z
  .object({
    name: z.string().trim().min(1, 'Name is required'),
    type: z.enum(['agency', 'supplier', 'ballpark', 'admin']).default('supplier'),
    website: z.string().trim().url().optional().or(z.literal('')),
    description: z.string().trim().optional(),
    address: z.string().trim().optional(),
    city: z.string().trim().optional(),
    country: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    email: z.string().trim().email().optional().or(z.literal('')),
    company_number: z.string().trim().optional(),
    vat_number: z.string().trim().optional(),
    vat_registered: z.boolean().optional(),
    default_currency: z.string().trim().optional(),
    logo_url: z.string().trim().optional(),
    cover_image_url: z.string().trim().optional(),
  })
  .strip(); // drop unknown keys — org.service only writes the columns it names

// GET /api/admin/orgs — every org (incl. suspended), newest first.
router.get('/', async (_req, res, next) => {
  try { res.json(await OrgService.getAllForAdmin()); } catch (err) { next(err); }
});

// GET /api/admin/orgs/:id
router.get('/:id', async (req, res, next) => {
  try {
    const org = await OrgService.getById(req.params.id);
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(org);
  } catch (err) { next(err); }
});

// POST /api/admin/orgs — create (admin concierge; import pre-fills the form).
router.post('/', async (req, res, next) => {
  const parsed = CreateBody.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
  }
  try { res.status(201).json(await OrgService.create(parsed.data)); } catch (err) { next(err); }
});

// PATCH /api/admin/orgs/:id/active { active } — approve (activate) / suspend
// (deactivate). is_active gates marketplace visibility (Liam, confirmed 2026-09-20).
const ActiveBody = z.object({ active: z.boolean() });
router.patch('/:id/active', async (req, res, next) => {
  const parsed = ActiveBody.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'active (boolean) is required' });
  try {
    const org = await OrgService.setActive(req.params.id, parsed.data.active);
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(org);
  } catch (err) { next(err); }
});

module.exports = router;
