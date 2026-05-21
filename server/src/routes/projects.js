const router = require('express').Router();
const ProjectService = require('../services/project.service');
const ProjectCategoryService = require('../services/project-category.service');

router.get('/', async (req, res, next) => {
  try {
    const projects = await ProjectService.getAll(req.query.org_id);
    res.json(projects);
  } catch (err) { next(err); }
});

// v1.39: preview the next auto-ref for an org without burning the counter.
// Used by the create-project modal to render the "Ref WA-014" chip
// before the user clicks Create. Mounted before /:id so the literal
// path wins.
router.get('/next-ref', async (req, res, next) => {
  try {
    const ref = await ProjectService.previewNextRef(req.query.org_id);
    res.json({ ref });
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const project = await ProjectService.getById(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try {
    // v1.39d diagnostic — see exactly what fields land in the create
    // payload so we can verify the AI → modal → API mapping when
    // something looks missing on the project page.
    console.log('[projects.create] payload', JSON.stringify({
      org_id:         req.body.org_id,
      ref_in:         req.body.ref || null,
      name:           req.body.name,
      event_name:     req.body.event_name,
      client_name:    req.body.client_name,
      venue_name:     req.body.venue_name,
      venue_city:     req.body.venue_city,
      event_date:     req.body.event_date,
      duration_days:  req.body.duration_days,
      guest_count:    req.body.guest_count,
      project_budget: req.body.project_budget,
      event_type:     req.body.event_type,
      tier:           req.body.tier,
      currency:       req.body.currency,
      margin_pct:     req.body.default_margin_pct,
      contingency_pct: req.body.default_contingency_pct,
      vat_pct:        req.body.default_vat_pct,
      raw_brief_text_chars: (req.body.raw_brief_text || '').length
    }, null, 2));
    const project = await ProjectService.create(req.body);
    console.log('[projects.create] saved', project.ref, project.id);
    res.status(201).json(project);
  } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const project = await ProjectService.update(req.params.id, req.body);
    if (!project) return res.status(404).json({ error: 'Not found' });
    const updated = await ProjectService.recalcTotals(req.params.id);
    res.json(updated);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const project = await ProjectService.softDelete(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (err) { next(err); }
});

// v1.22: clone a project's top-level facts into a new one. Categories,
// items, estimates, and messages do NOT carry over — see project.service
// .duplicate() for the field list.
router.post('/:id/duplicate', async (req, res, next) => {
  try {
    const project = await ProjectService.duplicate(req.params.id);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.status(201).json(project);
  } catch (err) { next(err); }
});

// ── Brief tab — scope picker + per-category briefs ───────────────────
//
// The Brief tab edits the (project, category) pairing directly. PATCH
// upserts the row (insert or update by composite key). DELETE clears
// the row when the user deselects a category.

router.get('/:projectId/categories', async (req, res, next) => {
  try { res.json(await ProjectCategoryService.getByProject(req.params.projectId)); }
  catch (err) { next(err); }
});

router.patch('/:projectId/categories/:categoryId', async (req, res, next) => {
  try {
    // v1.39d diagnostic — confirm category brief + budget land here.
    console.log('[project_categories.upsert]', JSON.stringify({
      project_id:  req.params.projectId,
      category_id: req.params.categoryId,
      requirement_brief_chars: (req.body?.requirement_brief || '').length,
      requirement_brief_preview: (req.body?.requirement_brief || '').slice(0, 80),
      ballpark_budget: req.body?.ballpark_budget ?? null
    }));
    const pc = await ProjectCategoryService.upsert(
      req.params.projectId, req.params.categoryId, req.body || {}
    );
    res.json(pc);
  } catch (err) { next(err); }
});

router.delete('/:projectId/categories/:categoryId', async (req, res, next) => {
  try {
    const pc = await ProjectCategoryService.remove(
      req.params.projectId, req.params.categoryId
    );
    if (!pc) return res.status(404).json({ error: 'Not found' });
    res.json(pc);
  } catch (err) { next(err); }
});

// Build tab — soft toggle a category's project scope. body: { active: boolean }
// Distinct from the DELETE above (Brief tab's hard delete). Preserves
// requirement_brief across un-scope → re-scope so users don't lose work.
router.put('/:projectId/categories/:categoryId/scope', async (req, res, next) => {
  try {
    const active = req.body?.active !== false;
    const pc = await ProjectCategoryService.setScope(
      req.params.projectId, req.params.categoryId, active
    );
    if (!pc && !active) return res.status(404).json({ error: 'Not found' });
    res.json(pc);
  } catch (err) { next(err); }
});

// PATCH /:id/images — update project image URLs and card color
router.patch('/:id/images', async (req, res, next) => {
  try {
    const { cover_image_url, client_logo_url, card_color } = req.body;
    const updates = {};
    if (cover_image_url !== undefined) updates.cover_image_url = cover_image_url;
    if (client_logo_url !== undefined) updates.client_logo_url = client_logo_url;
    if (card_color !== undefined) updates.card_color = card_color;
    const project = await ProjectService.update(req.params.id, updates);
    if (!project) return res.status(404).json({ error: 'Not found' });
    res.json(project);
  } catch (err) { next(err); }
});

module.exports = router;
