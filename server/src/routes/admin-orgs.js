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
const CatalogueExtract = require('../services/catalogue-extract.service');
const { OrganisationUpdateSchema } = require('../schemas/organisation.schema');
const { StoreItemCreateSchema, StoreItemUpdateSchema } = require('../schemas/store-item.schema');
const { ORG_PROFILE_SELECT, toProfile, buildOrgUpdate } = require('../services/org-profile.util');

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
    const { sets, vals } = buildOrgUpdate(parsed.data);
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.params.id);
    const upd = await pool.query(
      `UPDATE orgs SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${vals.length} AND deleted_at IS NULL RETURNING id`,
      vals,
    );
    if (!upd.rows.length) return res.status(404).json({ error: 'Not found' });
    const fresh = await pool.query(ORG_PROFILE_SELECT, [req.params.id]);
    res.json(toProfile(fresh.rows[0]));
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

// DELETE /api/admin/orgs/:orgId/items/:itemId — soft delete.
router.delete('/:orgId/items/:itemId', async (req, res, next) => {
  try {
    if (!(await orgItemOr(res, req.params.itemId, req.params.orgId))) return;
    await ItemService.softDelete(req.params.itemId);
    res.status(204).end();
  } catch (err) { next(err); }
});

// ── pV2-STORE-EXTRACT-01 — website catalogue extract (admin, org-scoped) ──────
// Analyse is read-only (writes nothing); Pull creates PENDING items on :orgId via
// ItemService.createForOrg. Inherits the admin gate (authenticate +
// admin.cross_org_view) from the mount, so it's platform-admin only. org is :orgId
// from the URL (never the body) — same invariant as the item routes above.
const ExtractUrlBody = z.object({ url: z.string().trim().url('A valid URL is required') });
const ExtractPrepareBody = z.object({
  groups: z.array(z.object({ key: z.string().trim().min(1), sample: z.string().trim().optional() })).min(1).max(60),
});
const MappingRow = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  subcategoryId: z.string().uuid().nullable().optional(),
  subcategoryName: z.string().trim().optional(),
  isNew: z.boolean().optional(),
  newParentId: z.string().uuid().nullable().optional(), // parent for a new 3rd-level node (the L2)
});
const ExtractPullBody = z.object({
  // Allow a large selection — the service caps processing at MAX_PULL_URLS and
  // reports the overflow as 'dropped' rows (visible), rather than a hard 400.
  urls: z.array(z.string().trim().url()).min(1).max(500),
  mode: z.enum(['review', 'full']).optional(),
  mapping: z.record(z.string(), MappingRow).optional(),
});

// POST /api/admin/orgs/:orgId/extract/analyse { url } → the read-only report.
// A HOMEPAGE (whole-site) analyse fans out over every section as a BACKGROUND job
// (returns { jobId, async:true } → poll the job route); a section/product URL stays
// a fast synchronous crawl.
router.post('/:orgId/extract/analyse', async (req, res, next) => {
  const parsed = ExtractUrlBody.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'A valid url is required' });
  try {
    const url = parsed.data.url;
    // WooCommerce → structured Store-API analyse (sync, fast), whatever the path.
    // Generic homepage → the fan-out job; generic section/product → the sync crawl.
    const profile = await CatalogueExtract.detectProfile(url);
    if (profile === 'woo') return res.json(await CatalogueExtract.analyse(url, 'woo'));
    const isHome = (() => { try { return new URL(url).pathname.replace(/\/$/, '') === ''; } catch { return false; } })();
    res.json(isHome
      ? await CatalogueExtract.startAnalyseJob(req.params.orgId, url)
      : await CatalogueExtract.analyse(url, profile));
  } catch (err) { next(err); }
});

// POST /api/admin/orgs/:orgId/extract/prepare { groups[] } → per-group cat/subcat
// suggestion + the marketplace taxonomy tree (Liam's Prepare step).
router.post('/:orgId/extract/prepare', async (req, res, next) => {
  const parsed = ExtractPrepareBody.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'groups (1-60) are required' });
  try { res.json(await CatalogueExtract.prepare(parsed.data.groups)); } catch (err) { next(err); }
});

// POST /api/admin/orgs/:orgId/extract/prepare/apply { mapping } → CATEGORIES-ONLY:
// create the new subcats/sub-subcats the Prepare mapping needs, WITHOUT pulling items
// (shape the taxonomy up front; load items later). Idempotent.
router.post('/:orgId/extract/prepare/apply', async (req, res, next) => {
  const mapping = req.body?.mapping;
  if (!mapping || typeof mapping !== 'object') return res.status(400).json({ error: 'mapping is required' });
  const parsed = z.record(z.string(), MappingRow).safeParse(mapping);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid mapping' });
  try { res.json(await CatalogueExtract.applyMapping(parsed.data)); } catch (err) { next(err); }
});

// POST /api/admin/orgs/:orgId/extract/pull { urls[], mode?, mapping? } → START a
// background pull job (a whole catalogue takes minutes). Returns the job id at once;
// the client polls the job route below and can re-attach after leaving the page.
router.post('/:orgId/extract/pull', async (req, res, next) => {
  const parsed = ExtractPullBody.safeParse(req.body || {});
  if (!parsed.success) return res.status(400).json({ error: 'urls (1-500 valid URLs) are required' });
  try {
    res.json(await CatalogueExtract.startPull(req.params.orgId, parsed.data.urls, { mode: parsed.data.mode, mapping: parsed.data.mapping }, req.user?.id || null));
  } catch (err) { next(err); }
});

// GET /api/admin/orgs/:orgId/extract/job → the org's active (running) pull job, or
// null — the panel calls this on load to re-attach to a pull started earlier.
router.get('/:orgId/extract/job', async (req, res, next) => {
  try { res.json(await CatalogueExtract.activeJobForOrg(req.params.orgId)); } catch (err) { next(err); }
});

// GET /api/admin/orgs/:orgId/extract/job/:jobId → poll one job (status/progress/results).
router.get('/:orgId/extract/job/:jobId', async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.jobId).success) return res.status(400).json({ error: 'Invalid job id' });
  try {
    const job = await CatalogueExtract.getJob(req.params.jobId, req.params.orgId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
  } catch (err) { next(err); }
});

// POST /api/admin/orgs/:orgId/extract/job/:jobId/cancel → request cancel; the runner
// stops before the next item. Items already created stay pending.
router.post('/:orgId/extract/job/:jobId/cancel', async (req, res, next) => {
  if (!z.string().uuid().safeParse(req.params.jobId).success) return res.status(400).json({ error: 'Invalid job id' });
  try { res.json({ cancelling: await CatalogueExtract.cancelJob(req.params.jobId, req.params.orgId) }); } catch (err) { next(err); }
});

module.exports = router;
