/**
 * v1.65cu (p0008) — Public /api/brief/:token routes.
 *
 * No auth — the token is the credential. Mounted at /api/brief in
 * the main router (no auth middleware applied to this prefix).
 *
 *   GET  /api/brief/:token           — thread + items + brand metadata
 *   POST /api/brief/:token/reply     — supplier reply: text + per-item actions
 *   POST /api/brief/:token/holding   — convenience: flip brief_sent + quoted
 *                                       items to holding with a next_action_by
 *
 * Every state change runs through message-item.service.transitionItem
 * so the audit log stays the single source of truth.
 */

const router = require('express').Router();
const pool = require('../db/pool');
const {
  transitionItem, aggregateStatus, getByMessage, getThreadByToken,
} = require('../services/message-item.service');
const { replyNotificationEmail } = require('../services/notification.service');

const PUBLIC_BASE_URL =
  process.env.PUBLIC_APP_URL ||
  process.env.APP_URL ||
  'http://localhost:4200';

/** Resolve a token → message row + side metadata; 404 when missing. */
async function loadThread(token, res) {
  if (!token || !/^[a-f0-9]{8,}$/i.test(token)) {
    res.status(400).json({ error: 'invalid token' });
    return null;
  }
  const thread = await getThreadByToken(token);
  if (!thread) {
    res.status(404).json({ error: 'thread not found' });
    return null;
  }
  return thread;
}

/** Fetch every message in the same (project × supplier × category)
    thread the token's message belongs to. Public view is read-only
    on this list — supplier sees their own outbound + the agent's
    inbound replies, ordered chronologically. */
async function loadThreadMessages(msg) {
  const r = await pool.query(
    `SELECT m.*,
            u.name AS sender_name
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
      WHERE m.project_id      = $1
        AND m.supplier_org_id IS NOT DISTINCT FROM $2
        AND m.category_id     IS NOT DISTINCT FROM $3
      ORDER BY m.created_at ASC`,
    [msg.project_id, msg.supplier_org_id, msg.category_id]
  );
  return r.rows;
}

// ── GET /api/brief/:token ────────────────────────────────────────────
router.get('/:token', async (req, res, next) => {
  try {
    const thread = await loadThread(req.params.token, res);
    if (!thread) return;
    const { message, items } = thread;
    const allMessages = await loadThreadMessages(message);

    // Aggregate per-item across every message in the thread so the
    // status pill at the top reflects the latest state across all
    // outreach rows (a supplier may have multiple brief rows from
    // the same agency over time).
    const allItems = [];
    for (const m of allMessages) {
      const its = await getByMessage(m.id);
      allItems.push(...its);
    }

    res.json({
      message: {
        id: message.id,
        project_id: message.project_id,
        ref_code: message.ref_code,
        subject: message.subject,
        body: message.body,
        token: message.token,
        next_action_by: message.next_action_by,
        contact_name: message.contact_name,
        category_id: message.category_id,
        category_name: message.category_name,
        created_at: message.created_at,
      },
      thread: {
        agency_name:      message.agency_name,
        agency_logo_url:  message.agency_logo_url,
        supplier_name:    message.supplier_name,
        supplier_logo_url: message.supplier_logo_url,
        project_name:     message.project_name,
        project_event_date: message.project_event_date,
        category_name:    message.category_name,
        // Aggregate status (supplier view).
        status:           aggregateStatus(allItems, 'supplier'),
      },
      messages: allMessages.map(m => ({
        id:           m.id,
        direction:    m.direction,
        body:         m.body,
        subject:      m.subject,
        sender_name:  m.sender_name,
        next_action_by: m.next_action_by,
        created_at:   m.created_at,
        msg_status:   m.msg_status,
      })),
      items,                              // items on THIS outreach row only
      brief_url: `${PUBLIC_BASE_URL}/brief/${message.token}`,
    });
  } catch (err) { next(err); }
});

// ── POST /api/brief/:token/reply ─────────────────────────────────────
router.post('/:token/reply', async (req, res, next) => {
  try {
    const thread = await loadThread(req.params.token, res);
    if (!thread) return;
    const { message } = thread;
    const {
      text, item_actions, next_action_by, attachments,
    } = req.body || {};

    const actions = Array.isArray(item_actions) ? item_actions : [];
    const hasText = !!(text && String(text).trim());
    if (!hasText && !actions.length) {
      return res.status(400).json({ error: 'reply needs text or item_actions' });
    }

    const db = await pool.connect();
    try {
      await db.query('BEGIN');

      // 1. Inbound reply row attached to the same thread.
      const ins = await db.query(
        `INSERT INTO messages
           (project_id, supplier_org_id, category_id, category_name,
            supplier_name, subject, body, direction, msg_status, read,
            next_action_by, ref_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'inbound', 'unread', false, $8, $9)
         RETURNING id`,
        [message.project_id, message.supplier_org_id, message.category_id,
         message.category_name, message.supplier_name,
         `Re: ${message.subject || message.ref_code || ''}`,
         hasText ? text : '',
         next_action_by || null,
         message.ref_code]
      );
      const replyId = ins.rows[0].id;

      // 2. Each item action → transitionItem.
      const changes = [];
      for (const a of actions) {
        const { message_item_id, action, reason_code, note,
                name, description, price, unit } = a || {};
        if (!message_item_id || !action) continue;

        let toStatus = null;
        let extra = null;
        switch (action) {
          case 'accept':  toStatus = 'accepted'; break;
          case 'decline': toStatus = 'declined_by_supplier'; break;
          case 'adjust':  toStatus = 'adjusted_by_supplier';
                          extra = { name, description, price, unit }; break;
          case 'quote':   toStatus = 'quoted';
                          extra = { name, description, price, unit }; break;
          // v1.65cx (p0011 §2) — Think + Holding both land on
          // status='holding'; the friendlier label is client-side
          // only. Both carry an optional next_action_by.
          case 'think':   toStatus = 'holding'; break;
          case 'holding': toStatus = 'holding'; break;
          default:        continue;
        }

        // pV2-UNIFY-01: `message_item_id` now carries the project_items.id the
        // reader emits (the unified line-state row).
        const before = await db.query(
          `SELECT name, price_current, status FROM project_items WHERE id = $1`,
          [message_item_id]
        );
        if (!before.rows.length) continue;
        const beforeRow = before.rows[0];

        const result = await transitionItem({
          itemId: message_item_id,
          toStatus,
          actor: { type: 'supplier' },
          reasonCode: reason_code || null,
          note: note || null,
          priceBefore: beforeRow.price_current,
          priceAfter: price != null ? price : null,
          extra,
          nextActionBy: next_action_by !== undefined ? (next_action_by || null) : undefined,
          executor: db,
        });

        changes.push({
          name: beforeRow.name,
          fromLabel: beforeRow.status,
          toLabel: result.toStatus,
        });
      }

      await db.query('COMMIT');

      // 3. Notify the agent. Best-effort, fire-and-forget — must not
      //    fail the reply if Resend hiccups.
      try {
        const agent = await pool.query(
          `SELECT u.email
             FROM projects p
             JOIN orgs o ON o.id = p.org_id
             LEFT JOIN users u ON u.org_id = o.id
            WHERE p.id = $1
            LIMIT 1`,
          [message.project_id]
        );
        const agentEmail = agent.rows[0]?.email;
        if (agentEmail && process.env.QUOTE_REQUEST_EMAILS_ENABLED === 'true') {
          const summary = changes.length
            ? `replied with ${changes.length} item update${changes.length === 1 ? '' : 's'}`
            : 'sent a message';
          replyNotificationEmail({
            to: agentEmail,
            refCode: message.ref_code || '—',
            senderName: message.supplier_name || 'Supplier',
            summaryLine: summary,
            changes,
            threadUrl: `${PUBLIC_BASE_URL}/projects/${message.project_id}/messages`,
          }).catch(e => console.error('[reply-notify] send failed:', e.message));
        }
      } catch (e) {
        console.error('[reply-notify] lookup failed:', e.message);
      }

      res.json({ ok: true, reply_id: replyId, changes });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  } catch (err) { next(err); }
});

// ── POST /api/brief/:token/holding ───────────────────────────────────
// Convenience wrapper for the "Working on it — back to you {date}" chip.
router.post('/:token/holding', async (req, res, next) => {
  try {
    const thread = await loadThread(req.params.token, res);
    if (!thread) return;
    const { message, items } = thread;
    const { next_action_by, text } = req.body || {};
    if (!next_action_by) {
      return res.status(400).json({ error: 'next_action_by required' });
    }

    const db = await pool.connect();
    try {
      await db.query('BEGIN');

      // Inbound holding message.
      await db.query(
        `INSERT INTO messages
           (project_id, supplier_org_id, category_id, category_name,
            supplier_name, subject, body, direction, msg_status, read,
            next_action_by, ref_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'inbound', 'unread', false, $8, $9)`,
        [message.project_id, message.supplier_org_id, message.category_id,
         message.category_name, message.supplier_name,
         `Re: ${message.subject || message.ref_code || ''}`,
         text || `Working on it — back to you by ${new Date(next_action_by).toLocaleString()}`,
         next_action_by, message.ref_code]
      );

      // Flip every brief_sent / quoted item on this outreach to holding.
      for (const it of items) {
        if (it.status === 'brief_sent' || it.status === 'quoted') {
          await transitionItem({
            itemId: it.id,
            toStatus: 'holding',
            actor: { type: 'supplier' },
            nextActionBy: next_action_by,
            executor: db,
          });
        }
      }

      await db.query('COMMIT');
      res.json({ ok: true });
    } catch (err) {
      await db.query('ROLLBACK');
      throw err;
    } finally {
      db.release();
    }
  } catch (err) { next(err); }
});

module.exports = router;
