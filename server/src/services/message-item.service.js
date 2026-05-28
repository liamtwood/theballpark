/**
 * v1.65cu (p0008) — message_items service.
 *
 * Single source of truth for per-item lifecycle transitions. Every
 * write path that mutates a message_items.status (cart `requestQuotes`,
 * agent reply endpoint, public supplier reply endpoint) goes through
 * `transitionItem()` so we never branch the audit log.
 *
 * The companion `message_item_events` table is append-only — the row
 * is the durable history; the `message_items` row is the projection.
 */

const pool = require('../db/pool');

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
  // row created earlier in the same transaction.
  const cur = await db.query('SELECT status, price_current FROM message_items WHERE id = $1', [itemId]);
  if (!cur.rows.length) throw new Error(`message_item not found: ${itemId}`);
  const fromStatus = cur.rows[0].status;
  const curPrice   = cur.rows[0].price_current;

  // Decide which price to write. priceAfter wins; else extra carries
  // it; else preserve current.
  const finalPriceAfter = priceAfter != null ? priceAfter
    : (extra && extra.price != null ? extra.price : null);

  // Build the UPDATE — only touch columns the caller passed.
  const sets = ['status = $2', 'updated_at = NOW()'];
  const params = [itemId, toStatus];
  if (finalPriceAfter != null) { sets.push(`price_current = $${params.length + 1}`); params.push(finalPriceAfter); }
  if (toStatus === 'adjusted_by_supplier') { sets.push(`adjusted_by = 'supplier'`); }
  else if (toStatus === 'adjusted_by_agent') { sets.push(`adjusted_by = 'agent'`); }
  if (reasonCode) { sets.push(`decline_reason = $${params.length + 1}`); params.push(reasonCode); }
  if (note)       { sets.push(`decline_note   = $${params.length + 1}`); params.push(note); }
  if (nextActionBy !== undefined) {
    sets.push(`next_action_by = $${params.length + 1}`); params.push(nextActionBy);
  }
  if (extra && extra.name != null)        { sets.push(`name        = $${params.length + 1}`); params.push(extra.name); }
  if (extra && extra.description != null) { sets.push(`description = $${params.length + 1}`); params.push(extra.description); }
  if (extra && extra.unit != null)        { sets.push(`unit        = $${params.length + 1}`); params.push(extra.unit); }

  await db.query(`UPDATE message_items SET ${sets.join(', ')} WHERE id = $1`, params);

  // Event row — append-only audit.
  await db.query(
    `INSERT INTO message_item_events
       (message_item_id, from_status, to_status, actor_type, actor_id,
        reason_code, note, price_before, price_after)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      itemId, fromStatus, toStatus, actor.type, actor.id || null,
      reasonCode, note,
      priceBefore != null ? priceBefore : curPrice,
      finalPriceAfter
    ]
  );

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

/** Fetch all message_items for a message, ordered for display.
    v1.65dc (p0013 follow-up) — JOIN items + orgs so the conversation
    surface can render the catalogue item's image_url + supplier_name
    in the marketplace-card shape (mirrors project-item.service which
    already does the same join). Columns prefixed with `item_` /
    `supplier_` are pulled-through; the existing message_items columns
    stay untouched. */
async function getByMessage(messageId, { executor = null } = {}) {
  const db = executor || pool;
  const r = await db.query(
    `SELECT mi.*,
            i.image_url       AS item_image_url,
            i.image_display   AS item_image_display,
            o.id              AS supplier_org_id,
            o.name            AS supplier_name,
            o.logo_url        AS supplier_logo_url
       FROM message_items mi
       LEFT JOIN items i ON i.id = mi.item_id
       LEFT JOIN orgs  o ON o.id = i.org_id
      WHERE mi.message_id = $1
      ORDER BY mi.created_at ASC`,
    [messageId]
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
  STATUS_META,
};
