const router = require('express').Router();
const pool = require('../db/pool');
const MessageService = require('../services/message.service');
const {
  transitionItem, getByMessage,
} = require('../services/message-item.service');
const { replyNotificationEmail } = require('../services/notification.service');

router.get('/', async (req, res, next) => {
  try {
    if (req.query.org_id) {
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
    const { text, item_actions, next_action_by, user_id } = req.body || {};
    const actions = Array.isArray(item_actions) ? item_actions : [];
    const hasText = !!(text && String(text).trim());
    if (!hasText && !actions.length) {
      db.release();
      return res.status(400).json({ error: 'reply needs text or item_actions' });
    }

    await db.query('BEGIN');

    const ins = await db.query(
      `INSERT INTO messages
         (project_id, user_id, supplier_org_id, category_id, category_name,
          supplier_name, subject, body, direction, msg_status, read,
          next_action_by, ref_code)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'outbound', 'sent', true,
               $9, $10)
       RETURNING id`,
      [lm.project_id, user_id || null, lm.supplier_org_id, lm.category_id,
       lm.category_name, lm.supplier_name,
       `Re: ${lm.subject || lm.ref_code || ''}`,
       hasText ? text : '',
       next_action_by || null, lm.ref_code]
    );
    const replyId = ins.rows[0].id;

    const changes = [];
    for (const a of actions) {
      const { message_item_id, action, reason_code, note,
              name, description, price, unit } = a || {};
      if (!message_item_id || !action) continue;

      let toStatus = null;
      let extra = null;
      switch (action) {
        case 'accept':  toStatus = 'accepted'; break;
        case 'decline': toStatus = 'declined_by_agent'; break;
        case 'adjust':  toStatus = 'adjusted_by_agent';
                        extra = { name, description, price, unit }; break;
        case 'pay':     toStatus = 'booked'; break;
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
        actor: { type: 'agent', id: user_id || null },
        reasonCode: reason_code || null,
        note: note || null,
        priceBefore: b.price_current,
        priceAfter: price != null ? price : null,
        extra,
        nextActionBy: next_action_by !== undefined ? (next_action_by || null) : undefined,
        executor: db,
      });

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

module.exports = router;
