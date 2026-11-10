// pV2-PROJECTS-01 — the v2 projects surface. Mounted on the GATED v2
// router (`v2.use('/projects-v2', …)`): inherits authenticate +
// requireActiveMembership. org_id is sacred — ALWAYS from req.user (JWT),
// NEVER the body/query.
//
// REBUILD (projects slice — STAGE 1: Create). Only the S1 surface is wired:
//   GET  /                → the caller's org's projects, as list cards
//   GET  /client-names    → distinct client names (About Project type-ahead)
//   GET  /next-ref        → the ref the next create would auto-assign
//   POST /                → create a project from an AI-parsed brief
//   GET  /:id             → one project's full detail
//   PUT  /:id             → partial update (Project Details tab)
//
// The S2/S3/S4 surface (items / estimate / components / quote-description /
// recommend / parse-intent) is DORMANT — its tables (project_items,
// project_item_quotes, messaging) aren't built yet, so those routes stay
// unwired until their slice is ported. The service still carries the dormant
// functions; they just have no route.

const router = require('express').Router();
const { z } = require('zod');
const projects = require('../services/projects.service');
const lines = require('../services/project-line.service');
const { ProjectCreateSchema, ProjectUpdateSchema } = require('../schemas/project-create.schema');
const {
  ItemAddSchema, CustomItemSchema, ItemPatchSchema, LineDetailsSchema, QuoteDescriptionSchema,
} = require('../schemas/project-line.schema');
const supplierInvites = require('../services/supplier-invite.service');
const { SupplierInviteSchema } = require('../schemas/supplier-invite.schema');
const { supplierInviteLimit } = require('../middleware/rate-limits');

// Validate UUID path slots up front (audit M1). Without this a malformed id
// reaches Postgres and surfaces as a 500 with a DB-shaped message (wrong status
// + info disclosure); now it's a clean 400. :lineId and :itemId are the
// project_items ROW id on the line-cluster routes (pV2-PRICING-SSOT-01 Part E).
const UUID = z.string().uuid();
const uuidParam = (label) => (req, res, next, val) =>
  UUID.safeParse(val).success ? next() : res.status(400).json({ error: `Invalid ${label}` });
router.param('id', uuidParam('project id'));
router.param('lineId', uuidParam('line id'));
router.param('itemId', uuidParam('line id'));
router.param('supplierId', uuidParam('supplier id'));

// GET / — org-scoped project list. org_id is sacred: JWT only.
router.get('/', async (req, res, next) => {
  try {
    res.json(await projects.listForOrg(req.user.org_id));
  } catch (err) {
    next(err);
  }
});

// GET /client-names — distinct client names this org has used (About Project
// type-ahead). Declared before /:id so it isn't captured as a project id.
router.get('/client-names', async (req, res, next) => {
  try {
    res.json(await projects.listClientNames(req.user.org_id));
  } catch (err) {
    next(err);
  }
});

// GET /next-ref — the ref the next create would auto-assign (a proposal the
// New Project form pre-fills + lets the user override). org from JWT. Declared
// before /:id so it isn't captured as a project id.
router.get('/next-ref', async (req, res, next) => {
  try {
    res.json({ ref: await projects.previewNextRef(req.user.org_id) });
  } catch (err) {
    next(err);
  }
});

// GET /my-components — pV2-BUILDUP-02 supplier component library. SHELVED
// (buildup); the Customize rail is not an S2 surface. Safe-empty so the dialog's
// type-ahead doesn't 404. Declared before /:id so it isn't captured as an id.
router.get('/my-components', (req, res) => res.json([]));

// POST / — create a project from an AI-parsed brief. org_id from JWT, NEVER
// the body; status defaults 'draft'. The service also seeds project_settings
// (all-NULL rates) + scaffolds project_categories from the parsed brief.
router.post('/', async (req, res, next) => {
  try {
    const parsed = ProjectCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    res.status(201).json(await projects.create(req.user.org_id, parsed.data));
  } catch (err) {
    next(err);
  }
});

// GET /:id — one project's full detail, org-scoped (JWT). 404 if not the
// caller's org / missing / soft-deleted.
router.get('/:id', async (req, res, next) => {
  try {
    const detail = await projects.getDetail(req.user.org_id, req.params.id);
    if (!detail) return res.status(404).json({ error: 'Project not found' });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// PUT /:id — partial update (Project Details tab). org from JWT; status is a
// TEXT codelist code. 404 when the row isn't this org's.
router.put('/:id', async (req, res, next) => {
  try {
    const parsed = ProjectUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const detail = await projects.updateDetail(req.user.org_id, req.params.id, parsed.data);
    if (!detail) return res.status(404).json({ error: 'Project not found' });
    res.json(detail);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id — soft-delete a DRAFT project (org-scoped, draft-gated). Non-draft
// or non-owned → 404 (the UI only offers delete on drafts). org_id is sacred: JWT.
router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await projects.softDelete(req.user.org_id, req.params.id, req.user.id);
    if (!ok) return res.status(404).json({ error: 'Project not found or not deletable (draft only)' });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// ── Line cluster (pV2-PROJECTS-S2) — freeze + overlay ────────────────────
// project_items (frozen requirement) + project_item_quotes (sparse overlay) +
// project_item_matches (AI provenance). org_id is sacred: JWT only. A service
// return of null = not this org's / not found (→ 404); false = no live line.

// GET /:id/items — the project's quote lines (resolved frozen + overlay).
router.get('/:id/items', async (req, res, next) => {
  try {
    const list = await lines.listItems(req.user.org_id, req.params.id);
    if (list === null) return res.status(404).json({ error: 'Project not found' });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /:id/categories — pV2-INVITE-SUPPLIER-01: the project's category buckets
// (the invite dialog's Category picker). Own-org only.
router.get('/:id/categories', async (req, res, next) => {
  try {
    const list = await lines.listProjectCategories(req.user.org_id, req.params.id);
    if (list === null) return res.status(404).json({ error: 'Project not found' });
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /:id/estimate — the server-computed estimate cascade (the ONE formula).
router.get('/:id/estimate', async (req, res, next) => {
  try {
    const breakdown = await lines.getEstimate(req.user.org_id, req.params.id);
    if (breakdown === null) return res.status(404).json({ error: 'Project not found' });
    res.json(breakdown);
  } catch (err) {
    next(err);
  }
});

// POST /:id/items — add a catalogue item (freeze clone). Idempotent for a live
// clone; revives a soft-deleted one. Returns the resolved line.
router.post('/:id/items', async (req, res, next) => {
  try {
    const parsed = ItemAddSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const { itemId, variant, quantity } = parsed.data;
    const line = await lines.addItem(req.user.org_id, req.params.id, itemId, variant ?? null, quantity ?? null);
    if (line === null) return res.status(404).json({ error: 'Project or item not found' });
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

// POST /:id/items/custom — add an ad-hoc line (no catalogue backing).
router.post('/:id/items/custom', async (req, res, next) => {
  try {
    const parsed = CustomItemSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await lines.addCustomItem(req.user.org_id, req.params.id, parsed.data);
    if (line === null) return res.status(404).json({ error: 'Project not found' });
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

// POST /:id/suppliers/invite — pV2-INVITE-SUPPLIER-01. Agency invites a supplier
// who isn't on Ballpark: creates (or silently reuses) a PENDING supplier org +
// invited owner seat + org_invites link. Agency-only; per-user rate-limited
// (abuse surface: mints orgs + emails arbitrary addresses). 409
// { existingSupplier } for an ACTIVE supplier match → the client offers "Use them".
router.post('/:id/suppliers/invite', supplierInviteLimit, async (req, res, next) => {
  try {
    if (req.user.org_type !== 'agency') return res.status(403).json({ error: 'Agency only' });
    const parsed = SupplierInviteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const out = await supplierInvites.inviteSupplier({
      agencyOrgId: req.user.org_id, userId: req.user.id, projectId: req.params.id, ...parsed.data,
    });
    if (out === null) return res.status(404).json({ error: 'Project not found' });
    res.status(201).json(out);
  } catch (err) {
    if (err.status === 409 && err.existingSupplier) {
      return res.status(409).json({ error: err.message, existingSupplier: err.existingSupplier });
    }
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /:id/suppliers/:supplierId/send-invite — the banner Send for an invited
// supplier who hasn't joined (Liam 2026-11-10: lines first, invite on Send).
// Emails the invite listing the lines put against them. Same limiter as invite.
router.post('/:id/suppliers/:supplierId/send-invite', supplierInviteLimit, async (req, res, next) => {
  try {
    if (req.user.org_type !== 'agency') return res.status(403).json({ error: 'Agency only' });
    const out = await supplierInvites.sendInvite({
      agencyOrgId: req.user.org_id, projectId: req.params.id, supplierOrgId: req.params.supplierId,
    });
    if (out === null) return res.status(404).json({ error: 'Project not found' });
    res.json(out);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /:id/items/:lineId — soft-remove a line (by project_items ROW id).
router.delete('/:id/items/:lineId', async (req, res, next) => {
  try {
    const result = await lines.removeItem(req.user.org_id, req.params.id, req.params.lineId);
    if (result === null) return res.status(404).json({ error: 'Project not found' });
    res.json({ removed: result });
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:lineId — set quantity and/or install choice.
router.patch('/:id/items/:lineId', async (req, res, next) => {
  try {
    const parsed = ItemPatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await lines.updateItem(req.user.org_id, req.params.id, req.params.lineId, parsed.data);
    if (line === null) return res.status(404).json({ error: 'Project not found' });
    if (line === false) return res.status(404).json({ error: 'Line not found' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:itemId/details — free-text + agent-editable line fields.
router.patch('/:id/items/:itemId/details', async (req, res, next) => {
  try {
    const parsed = LineDetailsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await lines.updateLineDetails(req.user.org_id, req.params.id, req.params.itemId, parsed.data);
    if (line === null) return res.status(404).json({ error: 'Line not found' });
    if (line === false) return res.status(400).json({ error: 'Nothing to update' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/items/:itemId/quote-description — the agent's client-facing text.
router.put('/:id/items/:itemId/quote-description', async (req, res, next) => {
  try {
    const parsed = QuoteDescriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await lines.setQuoteDescription(req.user.org_id, req.params.id, req.params.itemId, parsed.data.quoteDescription);
    if (line === null) return res.status(404).json({ error: 'Line not found' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// ── SHELVED buildup endpoints (safe empties, NOT S2) ─────────────────────
// Composition UI (Customize / Options / AI intent / recommend) is shelved
// ([[project_buildup_shelved]]); these exist only so client calls don't 404.
// They do no work — real behaviour returns in a later slice if revived.
router.get('/:id/items/:lineId/components', (req, res) =>
  res.json({ components: [], parentName: '', parentDescription: null, parentServices: null, marginPct: null, defaultMarginPct: null }));
router.post('/:id/items/:lineId/components', (req, res) => res.json([]));
router.post('/:id/items/:lineId/parse-intent', (req, res) =>
  res.json({ reply: '', actions: [], suggestions: [] }));
router.post('/:id/items/:lineId/question', (req, res) =>
  res.status(501).json({ error: 'Not available in this stage' }));
// Brief → recommended items: match each briefed category against the catalogue
// and add the top picks to the project (ported from v1, rebuild-schema matcher).
// org_id from the JWT (never the body). Each category is one Haiku round-trip.
router.post('/:id/recommend', async (req, res, next) => {
  try {
    const result = await projects.recommend(req.user.org_id, req.params.id);
    if (!result) return res.status(404).json({ error: 'Project not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
