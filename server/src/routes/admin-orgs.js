// BE-00127 slice 2 — admin Orgs management. Mounted under the /api/admin gate
// (authenticate + requireActiveMembership('admin.cross_org_view')), which sets
// the app.is_admin GUC so RLS (orgs_self) permits cross-org list/read/create.
// Approve/suspend (is_active toggle) is a held follow-up (slice 2b) pending
// Liam's mechanism call.
const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const OrgService = require('../services/org.service');
const ItemService = require('../services/item.service');
const { makeExtractRouter } = require('./extract-routes');
const { OrganisationUpdateSchema } = require('../schemas/organisation.schema');
const { StoreItemCreateSchema, StoreItemUpdateSchema } = require('../schemas/store-item.schema');
const { ORG_PROFILE_SELECT, toProfile } = require('../services/org-profile.util');
const { updateOrgProfile } = require('../services/org-profile.service');
const { withModeration } = require('../lib/moderation');

const BALLPARK_ORG_ID = '00000000-0000-0000-0000-000000000001';

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

// FR-00215: authoring an org (profile/catalogue) is enforced at the DB — RLS write
// = current-org only. A ballpark admin VIEWs any org (cross_org_view) and MODERATEs
// via the scoped escape, but EDITs an org only when it's their active org (a seat it
// holds). The old requireOrgEditSeat app-gate was interim tape — removed; the DB is
// the enforcement now (acceptance: db/rebuild/tests/fr00215_write_close.test.js).

// GET /api/admin/orgs — every org (incl. suspended), newest first.
router.get('/', async (_req, res, next) => {
  try { res.json(await OrgService.getAllForAdmin()); } catch (err) { next(err); }
});

// GET /api/admin/orgs/:id — the org's editable profile (camelCase OrgProfile
// shape, same as GET /api/organisation), for the admin profile editor.
router.get('/:id', async (req, res, next) => {
  try {
    const r = await pool.query(ORG_PROFILE_SELECT, [req.params.id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toProfile(r.rows[0]));
  } catch (err) { next(err); }
});

// PUT /api/admin/orgs/:id — admin edits ANOTHER org's profile (pV2-ADMIN-ORG-
// PROFILE-EDIT-01). Same OrganisationUpdateSchema + field-set as the self-serve
// PUT /api/organisation, keyed by :id. The admin.cross_org_view gate set the
// app.is_admin GUC, so RLS orgs_self permits the cross-org write.
router.put('/:id', async (req, res, next) => {
  const parsed = OrganisationUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
  }
  try {
    const changed = await updateOrgProfile(req.params.id, parsed.data);
    if (!changed) return res.status(400).json({ error: 'No fields to update' });
    const fresh = await pool.query(ORG_PROFILE_SELECT, [req.params.id]);
    if (!fresh.rows.length) return res.status(404).json({ error: 'Not found' });
    res.json(toProfile(fresh.rows[0]));
  } catch (err) { next(err); }
});

// POST /api/admin/orgs — create (admin concierge; import pre-fills the form).
router.post('/', async (req, res, next) => {
  const parsed = CreateBody.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
  }
  try {
    const org = await OrgService.create(parsed.data);
    // FR-00236 — admin onboarding grants the creating admin an OWNER seat, so they
    // can set the org up (and later hand off ownership to the real owner, who then
    // keeps/reduces/removes this support access via Team). This is HOW the admin
    // gets edit rights now that RLS requires a seat. Admin GUC authorises this
    // user_orgs insert (self-seat allowed only via app_is_admin).
    await pool.query(
      `INSERT INTO user_orgs (user_id, org_id, role, status, joined_at, created_by)
       VALUES ($1, $2, 'owner', 'active', NOW(), $1)
       ON CONFLICT (user_id, org_id) DO NOTHING`,
      [req.user.id, org.id]
    );
    res.status(201).json(org);
  } catch (err) { next(err); }
});

// PATCH /api/admin/orgs/:id/active { active } — approve (activate) / suspend
// (deactivate). is_active gates marketplace visibility (Liam, confirmed 2026-09-20).
const ActiveBody = z.object({ active: z.boolean() });
router.patch('/:id/active', async (req, res, next) => {
  const parsed = ActiveBody.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'active (boolean) is required' });
  try {
    // FR-00215 — cross-org moderation: suspend/approve writes orgs.status for an org
    // the admin holds no seat in, via the scoped app.svc_moderate escape (status only).
    const org = await withModeration(() => OrgService.setActive(req.params.id, parsed.data.active));
    if (!org) return res.status(404).json({ error: 'Not found' });
    res.json(org);
  } catch (err) { next(err); }
});

// ── pV2-ADMIN-ORG-ITEM-CREATE-01 — admin cross-org item create/edit ──────────
// Mirrors store-items.js, but the item's org is :orgId FROM THE URL (never the
// body/session — that invariant stays sacred on /api/store/items). The admin
// gate set app.is_admin so RLS permits the cross-org write. ItemService is reused
// as-is (create takes org_id in its data; the rest key by item id + we assert the
// item belongs to :orgId). Admin-created items default to PENDING (a) so they run
// the normal Approvals flow — flip to 'approved' + is_active:true for (b).
const ADMIN_ITEM_STATUS = 'pending'; // (a) pending — one-line flip to 'approved' for (b)

/** Resolve an item that belongs to :orgId, else 404 (no cross-org existence oracle). */
async function orgItemOr(res, itemId, orgId) {
  const item = await ItemService.getById(itemId);
  if (!item || item.deleted_at || item.org_id !== orgId) {
    res.status(404).json({ error: 'Not found' });
    return null;
  }
  return item;
}

// GET /api/admin/orgs/:orgId/items/:itemId — that org's item (for the editor).
router.get('/:orgId/items/:itemId', async (req, res, next) => {
  try {
    const item = await orgItemOr(res, req.params.itemId, req.params.orgId);
    if (item) res.json(item);
  } catch (err) { next(err); }
});

// POST /api/admin/orgs/:orgId/items — create an item FOR :orgId. org from the
// URL (never the body); shared write-policy + auto-classify in item.service.
router.post('/:orgId/items', async (req, res, next) => {
  try {
    const parsed = StoreItemCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid item' });
    const item = await ItemService.createForOrg({
      data: parsed.data,
      orgId: req.params.orgId,
      defaultStatus: ADMIN_ITEM_STATUS,
    });
    res.status(201).json(item);
  } catch (err) { next(err); }
});

// PUT /api/admin/orgs/:orgId/items/:itemId — edit that org's item (shared policy).
router.put('/:orgId/items/:itemId', async (req, res, next) => {
  try {
    const existing = await orgItemOr(res, req.params.itemId, req.params.orgId);
    if (!existing) return;
    const parsed = StoreItemUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid item' });
    res.json(await ItemService.applyEdit(existing, parsed.data, { defaultStatus: ADMIN_ITEM_STATUS }));
  } catch (err) { next(err); }
});

// POST /api/admin/orgs/:orgId/items/:itemId/duplicate — clone within the org.
router.post('/:orgId/items/:itemId/duplicate', async (req, res, next) => {
  try {
    if (!(await orgItemOr(res, req.params.itemId, req.params.orgId))) return;
    const copy = await ItemService.duplicate(req.params.itemId);
    if (!copy) return res.status(404).json({ error: 'Not found' });
    res.status(201).json(copy);
  } catch (err) { next(err); }
});

// PATCH /api/admin/orgs/:orgId/items/:itemId/active — publish/hide toggle.
router.patch('/:orgId/items/:itemId/active', async (req, res, next) => {
  try {
    if (typeof req.body?.is_active !== 'boolean') return res.status(400).json({ error: 'is_active (boolean) is required' });
    const existing = await orgItemOr(res, req.params.itemId, req.params.orgId);
    if (!existing) return;
    if (req.body.is_active === true && existing.approval_status !== 'approved') {
      return res.status(409).json({ error: 'Only approved items can be activated' });
    }
    res.json(await ItemService.update(req.params.itemId, { is_active: req.body.is_active }));
  } catch (err) { next(err); }
});

// DELETE /api/admin/orgs/:orgId/items/:itemId — soft delete (moderation takedown).
// Cross-org: the admin holds no seat in the item's org, so the soft-delete UPDATE
// (deleted_at) runs under the scoped app.svc_moderate escape — items_update + the
// column guard permit deleted_at under moderation. Without this it silently no-ops.
router.delete('/:orgId/items/:itemId', async (req, res, next) => {
  try {
    if (!(await orgItemOr(res, req.params.itemId, req.params.orgId))) return;
    await withModeration(() => ItemService.softDelete(req.params.itemId));
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── pV2-STORE-EXTRACT-01 — website catalogue extract (admin, org-scoped) ──────
// Analyse is read-only; Pull creates PENDING items on :orgId → Approvals. Routes
// are factored into extract-routes.js and shared with the self-serve own-org mount
// (/api/organisation/extract/*); here orgId is :orgId from the URL (never the body)
// and the mount's admin gate (authenticate + admin.cross_org_view) applies.
router.use('/:orgId/extract', makeExtractRouter((req) => req.params.orgId));

module.exports = router;
