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
const { z } = require('zod');
const projects = require('../services/projects.service');
const { ProjectCreateSchema, ProjectUpdateSchema } = require('../schemas/project-create.schema');

// Validate every :id / :itemId slot as a UUID up front (audit M1). Without
// this a malformed id reaches Postgres and surfaces as a 500 with a DB-shaped
// message (wrong status + info disclosure); now it's a clean 400.
const UUID = z.string().uuid();
router.param('id', (req, res, next, val) =>
  UUID.safeParse(val).success ? next() : res.status(400).json({ error: 'Invalid project id' })
);
router.param('itemId', (req, res, next, val) =>
  UUID.safeParse(val).success ? next() : res.status(400).json({ error: 'Invalid item id' })
);

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

// GET /my-components — pV2-BUILDUP-02: the caller-supplier's reusable components
// (derived from the children they've added before) for the Customize left rail
// + type-ahead. org from JWT. Declared before /:id.
router.get('/my-components', async (req, res, next) => {
  try {
    res.json(await projects.listMyComponents(req.user.org_id, req.query.q));
  } catch (err) {
    next(err);
  }
});

// POST / — create a project from an AI-parsed brief (no items). org_id
// from JWT, NEVER the body; status dual-written 'draft'.
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

// PUT /:id — partial update (Project Details tab). org from JWT; status
// dual-written. 404 when the row isn't this org's.
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

// POST /:id/recommend — find + add recommended items from the project's
// stored brief (v1 matcher per category). org from JWT. Returns a per-
// category summary; the Estimate tab then shows the grouped quote.
router.post('/:id/recommend', async (req, res, next) => {
  try {
    const result = await projects.recommend(req.user.org_id, req.params.id);
    if (result === null) return res.status(404).json({ error: 'Project not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ── Project Quote (slice 2) — minimal add/remove on project_items ────────
const QuoteAddSchema = z.object({ itemId: z.string().uuid() });

// GET /:id/items — the project's quote lines.
router.get('/:id/items', async (req, res, next) => {
  try {
    const lines = await projects.listItems(req.user.org_id, req.params.id);
    if (lines === null) return res.status(404).json({ error: 'Project not found' });
    res.json(lines);
  } catch (err) {
    next(err);
  }
});

// GET /:id/estimate — the server-computed estimate breakdown (the ONE
// cascade; the Estimate tab consumes this instead of recomputing). Optional
// ?uninstalled=<uuid,uuid> — lines the agent opted out of install on (install
// is otherwise assumed). Non-uuid entries are dropped.
router.get('/:id/estimate', async (req, res, next) => {
  try {
    const scope = req.query.scope === 'cart' ? 'cart' : 'all';
    const breakdown = await projects.getEstimate(req.user.org_id, req.params.id, scope);
    if (breakdown === null) return res.status(404).json({ error: 'Project not found' });
    res.json(breakdown);
  } catch (err) {
    next(err);
  }
});

// POST /:id/items — add an item to the quote (idempotent). org from JWT.
router.post('/:id/items', async (req, res, next) => {
  try {
    const parsed = QuoteAddSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await projects.addItem(req.user.org_id, req.params.id, parsed.data.itemId);
    if (line === null) return res.status(404).json({ error: 'Project or item not found' });
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

// POST /:id/items/custom — add a custom (ad-hoc) line with no catalogue backing
// (pV2-CUSTOMS-01). org from JWT. Cost optional (TBC until a supplier quotes).
const CustomAddSchema = z.object({
  categoryId: z.string().uuid().nullish(),
  name: z.string().trim().min(1),
  description: z.string().nullish(),
  cost: z.number().nonnegative().nullish(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().nullish(),
  installed: z.boolean().nullish(),
  installCost: z.number().nonnegative().nullish(),
  installUnit: z.string().nullish(),
  // pV2-BUILDUP-01 (UI1): the supplier this line is "for" — added in the
  // context of a supplier, ticked into project_item_suppliers. Optional:
  // null = "to source" (agent doesn't know the supplier yet).
  supplierOrgId: z.string().uuid().nullish(),
  // pV2-BUILDUP-03 — the parent quote line this custom line is a picked option
  // of (nests under it in the Final Quote). Null = a standalone custom line.
  optionOfLineId: z.string().uuid().nullish(),
}).strip();
router.post('/:id/items/custom', async (req, res, next) => {
  try {
    const parsed = CustomAddSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await projects.addCustomItem(req.user.org_id, req.params.id, parsed.data);
    if (line === null) return res.status(404).json({ error: 'Project not found' });
    res.status(201).json(line);
  } catch (err) {
    next(err);
  }
});

// POST /:id/items/:itemId/components — pV2-BUILDUP-02 supplier Customize: add
// child components under the line :itemId. Authority is SUPPLIER-scoped (the
// caller must own the parent line's per-supplier row) — NOT project ownership —
// so a supplier can build up a line they were asked to quote without touching
// the agent's canonical row. Batch insert.
const ComponentsSchema = z.object({
  components: z.array(z.object({
    id: z.string().uuid().optional(), // present = update an existing child
    categoryId: z.string().uuid().nullish(),
    name: z.string().trim().min(1),
    cost: z.number().nonnegative().nullish(),
    unit: z.string().nullish(),
    quantity: z.number().int().positive().optional(),
    kind: z.string().max(20).nullish(),
    included: z.boolean().optional(),
    description: z.string().nullish(),
    // Demo: the image rides inline as a data URL (project_items.image_url is
    // text). Generous cap so a small photo fits; the media pipeline replaces
    // this later. ~2.7MB of base64.
    image: z.string().max(2_800_000).nullish(),
  })),
  revisedPrice: z.number().nonnegative().nullish(),
  marginPct: z.number().nonnegative().max(100).nullish(),
  parentName: z.string().trim().min(1).max(200).optional(),
  parentDescription: z.string().max(4000).nullish(),
  parentServices: z.string().max(4000).nullish(),
  parentDetails: z.string().max(8000).nullish(),
  // The base row IS the parent line — its editable base cost / quantity / unit
  // persist here (base cost → price_ref, stored & never re-derived).
  parentQuantity: z.number().int().positive().optional(),
  parentUnit: z.string().max(40).nullish(),
  parentUnitPrice: z.number().nonnegative().nullish(),
}).strip();
// GET the line's current components (re-opening the estimate).
router.get('/:id/items/:itemId/components', async (req, res, next) => {
  try {
    const rows = await projects.listComponents(req.user.org_id, req.params.id, req.params.itemId);
    if (rows === null) return res.status(404).json({ error: 'Line not found or not yours to estimate' });
    res.json(rows);
  } catch (err) {
    next(err);
  }
});
// POST reconciles the full component set (add/update/remove) + optional revised
// price (the supplier's estimate-derived quote for the line).
router.post('/:id/items/:itemId/components', async (req, res, next) => {
  try {
    const parsed = ComponentsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const rows = await projects.saveComponents(
      req.user.org_id, req.params.id, req.params.itemId, parsed.data.components, parsed.data.revisedPrice, parsed.data.marginPct,
      parsed.data.parentName, parsed.data.parentDescription, parsed.data.parentServices,
      parsed.data.parentQuantity, parsed.data.parentUnit, parsed.data.parentUnitPrice, parsed.data.parentDetails
    );
    if (rows === null) return res.status(404).json({ error: 'Line not found or not yours to estimate' });
    res.status(201).json(rows);
  } catch (err) {
    next(err);
  }
});

// PUT /:id/items/:itemId/quote-description — set the AGENT's client-facing line
// description (the Quote document text). Project-owner scoped (any line in their
// project); writes the separate quote_description column, never the supplier's.
const QuoteDescriptionSchema = z.object({ quoteDescription: z.string().max(8000).nullable() });
router.put('/:id/items/:itemId/quote-description', async (req, res, next) => {
  try {
    const parsed = QuoteDescriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await projects.setQuoteDescription(req.user.org_id, req.params.id, req.params.itemId, parsed.data.quoteDescription);
    if (line === null) return res.status(404).json({ error: 'Line not found in your project' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:itemId — update the line: quantity (positive int) and/or
// installed (bool, or null to reset to default). At least one required.
const QuotePatchSchema = z
  .object({
    quantity: z.number().int().positive().optional(),
    installed: z.boolean().nullable().optional(),
  })
  .refine((b) => b.quantity !== undefined || b.installed !== undefined, {
    message: 'quantity or installed is required',
  });
router.patch('/:id/items/:itemId', async (req, res, next) => {
  try {
    const parsed = QuotePatchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await projects.updateItem(
      req.user.org_id, req.params.id, req.params.itemId, parsed.data
    );
    if (line === null) return res.status(404).json({ error: 'Project not found' });
    if (line === 'locked') return res.status(409).json({ error: 'Item is out for quote — change it in the inbox.' });
    if (line === false) return res.status(404).json({ error: 'Item not in quote' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// PATCH /:id/items/:itemId/details — edit the line's free-text details
// (name / description / Services) so the supplier can record what they changed
// on the line. NOT lock-gated (they annotate while it's out for quote).
const LineDetailsSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    description: z.string().max(4000).nullish(),
    services: z.string().max(4000).nullish(),
    details: z.string().max(8000).nullish(),
    cost: z.number().nonnegative().nullish(),
    unit: z.string().max(50).nullish(),
    categoryId: z.string().uuid().nullish(),
  })
  .refine(
    (b) => ['name', 'description', 'services', 'details', 'cost', 'unit', 'categoryId'].some((k) => b[k] !== undefined),
    { message: 'at least one field is required' },
  );
router.patch('/:id/items/:itemId/details', async (req, res, next) => {
  try {
    const parsed = LineDetailsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const line = await projects.updateLineDetails(req.user.org_id, req.params.id, req.params.itemId, parsed.data);
    if (line === null) return res.status(404).json({ error: 'Line not found or not yours to edit' });
    if (line === false) return res.status(404).json({ error: 'Item not in quote' });
    res.json(line);
  } catch (err) {
    next(err);
  }
});

// DELETE /:id/items/:itemId — remove an item from the quote.
router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const result = await projects.removeItem(req.user.org_id, req.params.id, req.params.itemId);
    if (result === null) return res.status(404).json({ error: 'Project not found' });
    if (result === 'locked') return res.status(409).json({ error: 'Item is out for quote — change it in the inbox.' });
    res.json({ removed: result });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
