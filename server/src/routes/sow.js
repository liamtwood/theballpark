// pV2-SOW-01 (Phase 1) — gated v2 SOW routes. Mounted on the v2 router
// (`v2.use('/sow', …)`): inherits authenticate + requireActiveMembership, so
// req.user is the verified caller and org_id is the JWT's, never the client's.
//
// v1 is CONTENT-AUTHORED and BIDIRECTIONAL: whoever is a party to the engagement
// can author a SOW (org_id = caller); the counterparty reads + signs. No org_type
// gate on the routes — both directions ride the same handlers; RLS + the gated
// document_sign definer enforce who may read, edit, and sign.

const router = require('express').Router();
const { z } = require('zod');
const sow = require('../services/sow.service');
const sowPdf = require('../services/sow-pdf.service');

const UUID = z.string().uuid();

// content is the structured SOW document (jsonb) the author fills — a flexible
// object (fixed sections + fields + a free-form `extra` list). Stored opaquely.
const Content = z.record(z.string(), z.unknown());

// POST /api/sow — create a draft SOW for an engagement (the caller is the author).
const CreateSchema = z.object({
  projectId: z.string().uuid(),
  supplierOrgId: z.string().uuid().optional(), // only when the agency authors
  name: z.string().trim().min(1).max(200),
  content: Content.optional(),
  depositPct: z.number().min(0).max(100).optional(),
});
router.post('/', async (req, res, next) => {
  try {
    const parsed = CreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const result = await sow.createDraft({
      orgId: req.user.org_id,
      orgType: req.user.org_type,
      userId: req.user.id,
      projectId: parsed.data.projectId,
      supplierOrgId: parsed.data.supplierOrgId,
      name: parsed.data.name,
      content: parsed.data.content,
      depositPct: parsed.data.depositPct,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/sow?projectId= — the SOWs on a project visible to the caller
// (its own + counterparty-authored on its engagements; RLS defines the set).
router.get('/', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.query.projectId || '').success) {
      return res.status(400).json({ error: 'projectId (uuid) is required' });
    }
    res.json(await sow.listForProject(req.query.projectId, req.user.org_id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/sow/prefill?projectId= — suggested content for a NEW SOW, from the
// project + the supplier's engagement items. Must be declared before '/:id'.
router.get('/prefill', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.query.projectId || '').success) {
      return res.status(400).json({ error: 'projectId (uuid) is required' });
    }
    res.json(await sow.prefill({ orgId: req.user.org_id, orgType: req.user.org_type, projectId: req.query.projectId }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/sow/:id — one SOW as a render payload (doc + parties + signatures + fee).
router.get('/:id', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    res.json(await sow.getById(req.params.id, req.user.org_id));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/sow/:id/parties — both parties' legal details (gated cross-org resolver).
router.get('/:id/parties', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    res.json(await sow.parties({ id: req.params.id }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/sow/:id/pdf — render the SOW to a PDF from the client's flat print
// model (Phase 1: body only). Visibility is enforced via getById (party-only).
router.post('/:id/pdf', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    const doc = await sow.getById(req.params.id, req.user.org_id); // throws 404 if not a party
    const blocks = Array.isArray(req.body && req.body.blocks) ? req.body.blocks : [];
    const meta = (req.body && req.body.meta) || {};
    // Supplier letterhead for the footer (gated cross-org resolver; best-effort).
    let sup = null;
    try { sup = (await sow.parties({ id: req.params.id })).supplier; } catch { /* no letterhead */ }
    // The supplier's standard T&C PDF to merge at Appendices (best-effort fetch).
    let termsBytes = null;
    if (doc.termsPdfUrl) {
      try { const r = await fetch(doc.termsPdfUrl); if (r.ok) termsBytes = Buffer.from(await r.arrayBuffer()); } catch { /* skip merge */ }
    }
    // Generation timestamp (from the client, so it matches the SOW identifier);
    // header shows date + time, e.g. "17 Nov 2026, 3:52 PM".
    const genAt = meta.generatedAt ? new Date(meta.generatedAt) : new Date();
    const stamp = Number.isNaN(genAt.getTime()) ? new Date() : genAt;
    const headerDate = `${stamp.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}, ${stamp.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
    const frame = {
      header: {
        project: meta.project || null,
        ref: meta.ref || null,
        date: headerDate,
      },
      footer: sup ? { name: sup.name, address: sup.address, companyNumber: sup.companyNumber, vatNumber: sup.vatNumber } : null,
    };
    // Embedded /Title → the viewer tab's name; fall back to the filename.
    const title = (typeof meta.title === 'string' && meta.title.trim()) || null;
    const bytes = await sowPdf.generateBody(blocks, frame, termsBytes, title);
    // Inline (opens in the browser's PDF viewer); the filename is what a
    // save-from-viewer uses — sanitise the client's suggestion to a safe token.
    const safe = String(meta.name || '').replace(/[^\w.-]/g, '').slice(0, 120) || 'statement-of-work.pdf';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${safe}"`);
    res.send(Buffer.from(bytes));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/sow/:id/review — a lifecycle transition. action is validated here;
// the party + status gate is enforced in the document_review definer.
const ReviewSchema = z.object({ action: z.enum(['send', 'revise', 'review', 'accept', 'co_approve', 'decline']) });
router.post('/:id/review', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid action' });
    res.json(await sow.review({ id: req.params.id, action: parsed.data.action }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/sow/:id/suggest — AI change proposals from the conversation (author runs it).
router.get('/:id/suggest', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    res.json(await sow.suggest({ sowId: req.params.id }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/sow/:id/apply-suggestions — apply the accepted/edited suggestions (author).
router.post('/:id/apply-suggestions', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    res.json(await sow.applySuggestions({ sowId: req.params.id, accepted: req.body || {} }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/sow/:id/history — status-change log + total comment count (party-only).
router.get('/:id/history', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    res.json(await sow.history({ entityType: 'sow', entityId: req.params.id }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// ── review comments (generic machine, entity_type='sow') ─────────────────────
// GET /api/sow/:id/comments — the thread visible to the caller (RLS: party-only).
router.get('/:id/comments', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    res.json(await sow.listComments({ sowId: req.params.id, viewerOrgId: req.user.org_id }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/sow/:id/comments — post a comment (either party). anchorId = SOW node id.
const CommentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
  anchorId: z.string().trim().max(200).nullish(),
});
router.post('/:id/comments', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    const parsed = CommentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const out = await sow.addComment({
      sowId: req.params.id, anchorId: parsed.data.anchorId || null,
      orgId: req.user.org_id, userId: req.user.id, body: parsed.data.body,
    });
    res.status(201).json(out);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/sow/:id/comments/:cid/resolve — close a comment (owner/author only).
router.post('/:id/comments/:cid/resolve', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success || !UUID.safeParse(req.params.cid).success) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    res.json(await sow.resolveComment({ commentId: req.params.cid, userId: req.user.id, viewerOrgId: req.user.org_id }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PATCH /api/sow/:id/comments/:cid — the author edits their own OPEN comment's body (RLS enforces).
const CommentEditSchema = z.object({ body: z.string().trim().min(1).max(4000) });
router.patch('/:id/comments/:cid', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success || !UUID.safeParse(req.params.cid).success) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    const parsed = CommentEditSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    res.json(await sow.editComment({ commentId: req.params.cid, body: parsed.data.body, viewerOrgId: req.user.org_id }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// DELETE /api/sow/:id/comments/:cid — the author removes their own comment (RLS enforces).
router.delete('/:id/comments/:cid', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success || !UUID.safeParse(req.params.cid).success) {
      return res.status(400).json({ error: 'Invalid id' });
    }
    res.json(await sow.deleteComment({ commentId: req.params.cid }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PATCH /api/sow/:id — edit a draft (author only; RLS gives the counterparty no
// write path, and the freeze trigger rejects edits once a signature exists).
const UpdateSchema = z
  .object({
    name: z.string().trim().min(1).max(200).optional(),
    content: Content.optional(),
    depositPct: z.number().min(0).max(100).optional(),
    presentation: z.record(z.string(), z.any()).optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: 'nothing to update' });
router.patch('/:id', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.id).success) return res.status(400).json({ error: 'Invalid SOW id' });
    const parsed = UpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    res.json(await sow.updateDraft({ id: req.params.id, userId: req.user.id, ...parsed.data }));
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// The sign flow (document_sign → counterparty_signed → executed) was retired in
// favour of the two-step review/approval flow (send → agent accept → supplier
// co_approve → Fully Executed) — Liam 2026-11-19.

module.exports = router;
