/**
 * v1.65cu (p0008) — message_items service.
 *
 * Single source of truth for per-item lifecycle transitions. Every
 * write path that mutates a line's status (cart `requestQuotes`, agent
 * reply endpoint, public supplier reply endpoint) goes through
 * `transitionItem()` so we never branch the audit log.
 *
 * pV2-UNIFY-01: the line IS a `project_items` row now (status / price_ref /
 * price_current live there). The companion `message_item_events` table is
 * append-only (FK `project_item_id`) — the row is the durable history; the
 * `project_items` row is the projection.
 */

const pool = require('../db/pool');
const { lineTotalSql } = require('./line-total.util');

/** Codelist semantic info — drives the computed aggregate thread
    status. Mirrors the migration's meta JSONB. */
const STATUS_META = {
  brief_sent:           { semantic: 'waiting', terminal: false, side: 'supplier' },
  holding:              { semantic: 'waiting', terminal: false, side: 'supplier' },
  quoted:               { semantic: 'quoted',  terminal: false, side: 'agent'    },
  adjusted_by_supplier: { semantic: 'quoted',  terminal: false, side: 'agent'    },
  adjusted_by_agent:    { semantic: 'waiting', terminal: false, side: 'supplier' },
  accepted:             { semantic: 'action',  terminal: false, side: 'agent'    },
  booked:               { semantic: 'booked',  terminal: true,  side: null       },
  declined_by_supplier: { semantic: 'danger',  terminal: true,  side: null       },
  declined_by_agent:    { semantic: 'danger',  terminal: true,  side: null       },
};

/**
 * Transition one message_item to a new status. Writes the update +
 * event row in a single transaction. Accepts an optional `executor`
 * to nest inside a caller-owned transaction (used by requestQuotes
 * which creates the message + items + events atomically).
 *
 * Args:
 *   itemId       — uuid of message_items.id
 *   toStatus     — message_item_status code
 *   actor        — { type: 'agent'|'supplier'|'system', id?: uuid }
 *   reasonCode?  — decline_reason_pre/post code
 *   note?        — free-text note (esp. when reason=other)
 *   priceBefore? — captured for the event row
 *   priceAfter?  — captured for the event row; also written to price_current
 *   extra?       — { name?, description?, unit? } applied when this is an Adjust
 *   nextActionBy? — sets/clears message_items.next_action_by
 *   executor?    — existing pg client/transaction; defaults to pool
 */
async function transitionItem({
  itemId, toStatus, actor,
  reasonCode = null, note = null,
  priceBefore = null, priceAfter = null,
  extra = null, nextActionBy = undefined,
  executor = null,
}) {
  if (!itemId)   throw new Error('itemId required');
  if (!toStatus) throw new Error('toStatus required');
  if (!STATUS_META[toStatus]) throw new Error(`unknown status: ${toStatus}`);
  if (!actor || !actor.type) throw new Error('actor.type required');

  const db = executor || pool;

  // Snapshot the current row so we know `from_status` + the previous
  // price for the event row. Caller-owned txn lets the read see the
  // row created earlier in the same transaction. pV2-UNIFY-01: `itemId`
  // is a project_items.id now — the single line-state table.
  const cur = await db.query('SELECT status, price_current FROM project_items WHERE id = $1', [itemId]);
  if (!cur.rows.length) throw new Error(`project_item not found: ${itemId}`);
  const fromStatus = cur.rows[0].status;
  const curPrice   = cur.rows[0].price_current;

  // Decide which price to write. priceAfter wins; else extra carries
  // it; else preserve current.
  const finalPriceAfter = priceAfter != null ? priceAfter
    : (extra && extra.price != null ? extra.price : null);

  // Build the UPDATE — only touch columns the caller passed. pV2-UNIFY-01:
  // project_items' projection columns are status / price_current /
  // decline_reason (+ the name/description/unit snapshot an Adjust overrides).
  // adjusted_by / decline_note / next_action_by were message_items-only — the
  // status code already encodes the side, and the append-only event row keeps
  // the full reason_code + note.
  const sets = ['status = $2', 'updated_at = NOW()'];
  const params = [itemId, toStatus];
  if (finalPriceAfter != null) { sets.push(`price_current = $${params.length + 1}`); params.push(finalPriceAfter); }
  const reasonText = reasonCode || note;
  if (reasonText) { sets.push(`decline_reason = $${params.length + 1}`); params.push(reasonText); }
  if (extra && extra.name != null)        { sets.push(`name        = $${params.length + 1}`); params.push(extra.name); }
  if (extra && extra.description != null) { sets.push(`description = $${params.length + 1}`); params.push(extra.description); }
  if (extra && extra.unit != null)        { sets.push(`unit        = $${params.length + 1}`); params.push(extra.unit); }

  await db.query(`UPDATE project_items SET ${sets.join(', ')} WHERE id = $1`, params);

  // Event row — append-only audit, keyed to the project_items line.
  await db.query(
    `INSERT INTO message_item_events
       (project_item_id, from_status, to_status, actor_type, actor_id,
        reason_code, note, price_before, price_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      itemId, fromStatus, toStatus, actor.type, actor.id || null,
      reasonCode, note,
      priceBefore != null ? priceBefore : curPrice,
      finalPriceAfter
    ]
  );

  // NOTE(pV2-UNIFY-01): the v1 ad-hoc "catalogue fork" (agency creates a
  // pending placeholder → the winning supplier's Adjust forks a supplier-owned
  // item) is not reachable in the unified model — a cart line is always owned
  // by exactly one supplier (items.org_id), so an adjusting supplier already
  // owns it and the fork was always a no-op here. Dropped with the merge.

  return { fromStatus, toStatus };
}

/**
 * Compute the aggregate `message_status` for a thread from its items.
 * Priority order documented in p0008 §1.2.
 *
 * Args:
 *   items — array of { status } (each from message_items)
 *   viewer — 'agent' | 'supplier' (changes the Action band ownership)
 * Returns: 'action' | 'waiting' | 'quoted' | 'booked' | 'closed' | ''
 */
function aggregateStatus(items, viewer) {
  if (!items || !items.length) return '';
  const statuses = items.map(i => i.status);
  const has = code => statuses.includes(code);

  // Terminal-only set?
  const allTerminal = statuses.every(s => STATUS_META[s]?.terminal);
  if (allTerminal) {
    return has('booked') ? 'booked' : 'closed';
  }

  // Whose turn is it overall?
  if (viewer === 'agent') {
    if (has('quoted') || has('adjusted_by_supplier') || has('accepted')) return 'action';
    if (has('brief_sent') || has('holding') || has('adjusted_by_agent')) return 'waiting';
  } else {
    // supplier
    if (has('brief_sent') || has('adjusted_by_agent')) return 'action';
    if (has('holding') || has('quoted') || has('adjusted_by_supplier')) return 'waiting';
    if (has('accepted')) return 'action'; // supplier still has Decline / Adjust pre-pay
  }
  // Fallback
  if (has('quoted')) return 'quoted';
  return 'waiting';
}

/** Fetch a message's line items for display. pV2-UNIFY-01: message_items is a
    stripped tag join (message_id + project_item_id) now, so this resolves the
    referenced project_items — the single line-state table — and returns each
    line's per-unit prices (price_ref / price_current), its status, and BOTH
    the "Original" and "Revised" line totals via the ONE shared formula
    (price × qty + install). The inbox renders those totals directly, so the
    per-head → line-total fix falls out of the reader pointing here.

    JOINs items + orgs for the catalogue image + owning supplier; buyer_status
    / seller_status come from the message_item_decisions satellite (latest per
    side), now keyed by project_item_id. */
async function getByMessage(messageId, { executor = null } = {}) {
  const db = executor || pool;
  const r = await db.query(
    `SELECT pi.id, pi.item_id,
            COALESCE(pi.name, i.name)              AS name,
            COALESCE(pi.description, i.description) AS description,
            pi.quantity, pi.unit, pi.installed, pi.status,
            pi.price_ref, pi.price_current,
            i.image_url       AS item_image_url,
            i.image_display   AS item_image_display,
            o.id              AS supplier_org_id,
            o.name            AS supplier_name,
            o.logo_url        AS supplier_logo_url,
            (${lineTotalSql('pi.price_ref')})                            AS original_total,
            (${lineTotalSql('COALESCE(pi.price_current, pi.price_ref)')}) AS revised_total,
            buyer.decision    AS buyer_status,
            buyer.user_id     AS buyer_user_id,
            buyer.created_at  AS buyer_at,
            seller.decision   AS seller_status,
            seller.user_id    AS seller_user_id,
            seller.created_at AS seller_at
       FROM message_items mtag
       JOIN project_items pi ON pi.id = mtag.project_item_id
       LEFT JOIN items i ON i.id = pi.item_id
       LEFT JOIN orgs  o ON o.id = i.org_id
       LEFT JOIN LATERAL (
         SELECT d.decision, d.user_id, d.created_at
           FROM message_item_decisions d
          WHERE d.project_item_id = pi.id AND d.side = 'buyer'
          ORDER BY d.created_at DESC LIMIT 1
       ) buyer ON TRUE
       LEFT JOIN LATERAL (
         SELECT d.decision, d.user_id, d.created_at
           FROM message_item_decisions d
          WHERE d.project_item_id = pi.id AND d.side = 'seller'
          ORDER BY d.created_at DESC LIMIT 1
       ) seller ON TRUE
      WHERE mtag.message_id = $1 AND pi.deleted_at IS NULL
      ORDER BY pi.created_at ASC`,
    [messageId]
  );
  return r.rows;
}

/** v1.65fW — record a buyer/seller decision on a message_item.
    Append-only — every click is a new row; the current state is the
    latest row per (message_item_id, side). Caller passes the actor's
    user_id + optional note. Returns the inserted row.

    Validates side ∈ { buyer, seller } and decision ∈ { accepted,
    declined } but leaves room for additional values (e.g. 'cleared'
    when we wire material-edit reset later). */
async function recordDecision({ messageItemId, side, decision, userId, note, executor = null }) {
  const db = executor || pool;
  if (!messageItemId) {
    const err = new Error('message_item_id is required'); err.status = 400; throw err;
  }
  if (side !== 'buyer' && side !== 'seller') {
    const err = new Error('side must be buyer or seller'); err.status = 400; throw err;
  }
  // v1.65fY — 'cleared' is an auto-inserted decision that wipes the
  // OTHER side's accept after a material edit. UI treats latest-
  // decision='cleared' as "no current decision".
  if (decision !== 'accepted' && decision !== 'declined' && decision !== 'cleared') {
    const err = new Error('decision must be accepted, declined, or cleared'); err.status = 400; throw err;
  }
  const r = await db.query(
    `INSERT INTO message_item_decisions
       (project_item_id, side, decision, user_id, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [messageItemId, side, decision, userId || null, note || null]
  );
  return r.rows[0];
}

/** v1.65fW — full decision history for a message_item, both sides,
    newest first. Powers the future "decision timeline" UI. */
async function listDecisions(messageItemId) {
  const r = await pool.query(
    `SELECT d.*, u.email AS user_email, u.name AS user_name
       FROM message_item_decisions d
       LEFT JOIN users u ON u.id = d.user_id
      WHERE d.project_item_id = $1
      ORDER BY d.created_at DESC`,
    [messageItemId]
  );
  return r.rows;
}

/** Look up a thread by token (public route). Returns the message row
    plus its items. Throws when token doesn't match a row. */
async function getThreadByToken(token) {
  const r = await pool.query(
    `SELECT m.*,
            ag.name             AS agency_name,
            ag.logo_url         AS agency_logo_url,
            so.name             AS supplier_name,
            so.logo_url         AS supplier_logo_url,
            p.name              AS project_name,
            p.event_date        AS project_event_date,
            c.name              AS category_name
       FROM messages m
       LEFT JOIN projects   p  ON m.project_id       = p.id
       LEFT JOIN orgs       ag ON p.org_id           = ag.id
       LEFT JOIN orgs       so ON m.supplier_org_id  = so.id
       LEFT JOIN categories c  ON m.category_id      = c.id
      WHERE m.token = $1
      LIMIT 1`,
    [token]
  );
  if (!r.rows.length) return null;
  const message = r.rows[0];
  const items = await getByMessage(message.id);
  return { message, items };
}

module.exports = {
  transitionItem,
  aggregateStatus,
  getByMessage,
  getThreadByToken,
  recordDecision,
  listDecisions,
  STATUS_META,
};
