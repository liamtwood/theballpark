// pV2-INBOX-01 — gated v2 inbox routes. Mounted on the v2 router
// (`v2.use('/inbox', …)`): inherits authenticate + requireActiveMembership,
// so req.user is the verified caller and org_id is the JWT's, never the
// client's (RP-INB1). Closes the v1 /api/messages gap where the supplier
// feed trusted a ?supplier_org_id query param.

const router = require('express').Router();
const { z } = require('zod');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const inbox = require('../services/inbox.service');

const canReply = requireActiveMembership('inbox.reply');

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

// GET /api/inbox/projects/:projectId/threads — the caller-supplier's
// conversation threads for one project (per category). org from JWT.
const UUID = z.string().uuid();
router.get('/projects/:projectId/threads', async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.projectId).success) {
      return res.status(400).json({ error: 'Invalid project id' });
    }
    res.json(await inbox.getSupplierThreads(req.user.org_id, req.params.projectId));
  } catch (err) {
    next(err);
  }
});

// POST /api/inbox/threads/:threadId/reply — the supplier replies in a
// thread: a chat message and/or per-item actions. org from JWT; the service
// verifies the thread is theirs (RP-INB1). Gated to inbox.reply.
const ReplySchema = z
  .object({
    text: z.string().trim().max(4000).optional(),
    itemActions: z
      .array(
        z.object({
          itemId: z.string().uuid(),
          action: z.enum(['accept', 'adjust', 'decline']),
          price: z.number().nonnegative().optional(),
          note: z.string().max(1000).optional(),
        })
      )
      .optional(),
  })
  .refine((d) => (d.text && d.text.trim()) || (d.itemActions && d.itemActions.length), {
    message: 'reply needs text or item actions',
  });

router.post('/threads/:threadId/reply', canReply, async (req, res, next) => {
  try {
    if (!UUID.safeParse(req.params.threadId).success) {
      return res.status(400).json({ error: 'Invalid thread id' });
    }
    const parsed = ReplySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    }
    const result = await inbox.reply({
      supplierOrgId: req.user.org_id,
      userId: req.user.id,
      threadId: req.params.threadId,
      text: parsed.data.text,
      itemActions: parsed.data.itemActions,
    });
    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
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
