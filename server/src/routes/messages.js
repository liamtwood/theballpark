const router = require('express').Router();
const pool = require('../db/pool');
const MessageService = require('../services/message.service');
const {
  transitionItem, getByMessage, recordDecision, listDecisions,
} = require('../services/message-item.service');
const { replyNotificationEmail } = require('../services/notification.service');

router.get('/', async (req, res, next) => {
  try {
    // v1.65ea (p0015) — supplier-side feed. Supplier persona's inbox
    // queries ?supplier_org_id= to get messages WHERE this org is
    // the recipient (joined with the sending agency's identity).
    if (req.query.supplier_org_id) {
      res.json(await MessageService.getAllForSupplier(req.query.supplier_org_id));
    } else if (req.query.org_id) {
      res.json(await MessageService.getAllByOrg(req.query.org_id));
    } else {
      res.json(await MessageService.getAll(req.query.project_id));
    }
  } catch (err) { next(err); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const msg = await MessageService.getById(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  } catch (err) { next(err); }
});

// v1.65g0 — soft delete a single message. Both agent and supplier
// can hit this; further fine-grained permissions can come later.
router.delete('/:id', async (req, res, next) => {
  try {
    const row = await MessageService.softDelete(req.params.id);
    if (!row) return res.status(404).json({ error: 'Not found' });
    res.json(row);
  } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
  try { res.status(201).json(await MessageService.create(req.body)); } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
  try {
    const msg = await MessageService.update(req.params.id, req.body);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  } catch (err) { next(err); }
});

router.patch('/:id', async (req, res, next) => {
  try {
    const msg = await MessageService.update(req.params.id, req.body);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const msg = await MessageService.hardDelete(req.params.id);
    if (!msg) return res.status(404).json({ error: 'Not found' });
    res.json(msg);
  } catch (err) { next(err); }
});

/** v1.65cu (p0008) — GET /api/messages/:id/items — message_items rows
    for one outreach message. Used by the agent inbox + the (future)
    public /brief route to render the conversation's item cards. */
router.get('/:id/items', async (req, res, next) => {
  try {
    res.json(await getByMessage(req.params.id));
  } catch (err) { next(err); }
});

/** v1.65cu (p0008) — agent-side reply. Mirrors the public
    /api/brief/:token/reply payload — same item_actions shape — just
    with actor_type='agent'. Writes an outbound message + transitions
    every touched message_item + fires the supplier-side reply
    notification email. */
router.post('/:id/reply', async (req, res, next) => {
  const db = await pool.connect();
  try {
    const lead = await db.query(
      `SELECT m.*, p.org_id AS project_org_id, so.email AS supplier_email,
              so.name AS supplier_name
         FROM messages m
         JOIN projects p ON p.id = m.project_id
         LEFT JOIN orgs so ON so.id = m.supplier_org_id
        WHERE m.id = $1
        LIMIT 1`,
      [req.params.id]
    );
    if (!lead.rows.length) return res.status(404).json({ error: 'message not found' });
    const lm = lead.rows[0];
    const { text, item_actions, next_action_by, user_id, viewer } = req.body || {};
    const isSupplier = viewer === 'supplier';
    const actions = Array.isArray(item_actions) ? item_actions : [];
    const hasText = !!(text && String(text).trim());
    if (!hasText && !actions.length) {
      db.release();
      return res.status(400).json({ error: 'reply needs text or item_actions' });
    }

    await db.query('BEGIN');

    // v1.65ed (p0015) — viewer-aware reply. Supplier-side actions
    // come from the in-app supplier persona (Ryan / Rocket Food)
    // pressing Accept/Decline/Adjust/Think on the Inbox tab. Mirrors
    // the brief.js public-token route's action mapping + actor.type
    // but reused through the in-app endpoint so the action flows
    // through transitionItem with the right side recorded.
    const direction  = isSupplier ? 'inbound'  : 'outbound';
    const msgStatus  = isSupplier ? 'unread'   : 'sent';
    const readFlag   = isSupplier ? false      : true;

    const ins = await db.query(
      `INSERT INTO messages
         (project_id, user_id, supplier_org_id, category_id, category_name,
          supplier_name, subject, body, direction, msg_status, read,
          next_action_by, ref_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
               $12, $13)
       RETURNING id`,
      [lm.project_id, user_id || null, lm.supplier_org_id, lm.category_id,
       lm.category_name, lm.supplier_name,
       `Re: ${lm.subject || lm.ref_code || ''}`,
       hasText ? text : '',
       direction, msgStatus, readFlag,
       next_action_by || null, lm.ref_code]
    );
    const replyId = ins.rows[0].id;

    const changes = [];
    for (const a of actions) {
      const { message_item_id, action, reason_code, note,
              name, description, price, unit, image_url } = a || {};
      if (!message_item_id || !action) continue;

      // v1.65et — image_url is supplier-side only and only meaningful
      // for adjust/quote (sets the photo on the forked catalogue
      // items row).
      let toStatus = null;
      let extra = null;
      switch (action) {
        case 'accept':  toStatus = 'accepted'; break;
        case 'decline': toStatus = isSupplier ? 'declined_by_supplier' : 'declined_by_agent'; break;
        case 'adjust':  toStatus = isSupplier ? 'adjusted_by_supplier' : 'adjusted_by_agent';
                        extra = { name, description, price, unit, imageUrl: image_url }; break;
        case 'quote':   if (!isSupplier) continue;
                        toStatus = 'quoted';
                        extra = { name, description, price, unit, imageUrl: image_url }; break;
        case 'pay':     if (isSupplier) continue;
                        toStatus = 'booked'; break;
        // v1.65cx (p0011 §2) — Think is the friendlier label for
        // Holding. Same status code; carries a next_action_by.
        case 'think':   toStatus = 'holding'; break;
        case 'holding': toStatus = 'holding'; break;
        default:        continue;
      }

      const before = await db.query(
        `SELECT name, price_current, status FROM message_items WHERE id = $1`,
        [message_item_id]
      );
      if (!before.rows.length) continue;
      const b = before.rows[0];

      const result = await transitionItem({
        itemId: message_item_id,
        toStatus,
        actor: isSupplier
          ? { type: 'supplier' }
          : { type: 'agent', id: user_id || null },
        reasonCode: reason_code || null,
        note: note || null,
        priceBefore: b.price_current,
        priceAfter: price != null ? price : null,
        extra,
        nextActionBy: next_action_by !== undefined ? (next_action_by || null) : undefined,
        executor: db,
      });

      // v1.65fW — accept / decline writes a row to the
      // message_item_decisions satellite.
      // v1.65fY — adjust / quote (a material edit) ALSO writes a
      // 'cleared' decision for the OTHER side, so an accept that
      // came in before the edit gets invalidated and the recipient
      // has to re-accept. Same for quote → cleared for buyer side.
      if (action === 'accept' || action === 'decline') {
        const side = isSupplier ? 'seller' : 'buyer';
        await db.query(
          `INSERT INTO message_item_decisions
             (message_item_id, side, decision, user_id, note)
           VALUES ($1, $2, $3, $4, $5)`,
          [message_item_id, side, action === 'accept' ? 'accepted' : 'declined',
           user_id || null, note || null]
        );
      } else if (action === 'adjust' || action === 'quote') {
        const otherSide = isSupplier ? 'buyer' : 'seller';
        await db.query(
          `INSERT INTO message_item_decisions
             (message_item_id, side, decision, user_id, note)
           VALUES ($1, $2, 'cleared', $3, $4)`,
          [message_item_id, otherSide, user_id || null,
           `auto-cleared — ${isSupplier ? 'supplier' : 'agent'} edited`]
        );
      }

      changes.push({ name: b.name, fromLabel: b.status, toLabel: result.toStatus });
    }

    await db.query('COMMIT');

    // Notify supplier — fire-and-forget.
    if (lm.supplier_email && process.env.QUOTE_REQUEST_EMAILS_ENABLED === 'true') {
      const PUBLIC_BASE_URL = process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:4200';
      const summary = changes.length
        ? `replied with ${changes.length} item update${changes.length === 1 ? '' : 's'}`
        : 'sent a message';
      replyNotificationEmail({
        to: lm.supplier_email,
        refCode: lm.ref_code || '—',
        senderName: 'The agency',
        summaryLine: summary,
        changes,
        threadUrl: `${PUBLIC_BASE_URL}/brief/${lm.token}`,
      }).catch(e => console.error('[agent-reply-notify] send failed:', e.message));
    }

    res.json({ ok: true, reply_id: replyId, changes });
  } catch (err) {
    try { await db.query('ROLLBACK'); } catch {}
    next(err);
  } finally {
    db.release();
  }
});

// v1.65fW — standalone decision record/list endpoints. The reply
// route above already writes a decision on accept/decline (via
// /api/messages/:id/reply), but the agent can also Accept a row
// from inside the cart drawer without going through a full reply
// flow — that path uses these endpoints. message_item.id alone is
// enough since the row's FK to messages identifies the thread.
router.post('/items/:itemId/decisions', async (req, res, next) => {
  try {
    const row = await recordDecision({
      messageItemId: req.params.itemId,
      side: req.body.side,
      decision: req.body.decision,
      userId: req.body.user_id,
      note: req.body.note,
    });
    res.status(201).json(row);
  } catch (err) { next(err); }
});
router.get('/items/:itemId/decisions', async (req, res, next) => {
  try {
    res.json(await listDecisions(req.params.itemId));
  } catch (err) { next(err); }
});

module.exports = router;
