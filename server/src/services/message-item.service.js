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

  // v1.65et (p0015) — catalogue fork. When a supplier adjusts (or
  // quotes) an ad-hoc item that the agency created as a pending
  // placeholder, fork a NEW items row owned by the supplier seeded
  // from their adjustment (price, name, description, unit, image).
  // The fork links the message_item to the supplier-owned items
  // row, simultaneously: (1) recording the supplier's quote and
  // (2) promoting the ad-hoc ask into the supplier's catalogue.
  //
  // Catalogue items (already owned by the supplier) skip the fork —
  // the adjustment is treated as a one-off override on the
  // message_item, not a catalogue update. A separate "Sync to
  // catalogue" action would handle that.
  const isSupplierQuote = actor.type === 'supplier'
    && (toStatus === 'adjusted_by_supplier' || toStatus === 'quoted');
  if (isSupplierQuote) {
    await maybeForkCatalogueItem(db, itemId, extra, finalPriceAfter);
  }

  return { fromStatus, toStatus };
}

/** v1.65et — when a supplier adjusts an ad-hoc (agency-pending) item,
    create a new items row owned by them seeded from their quote +
    re-link the message_item. No-op for catalogue items (supplier
    already owns them) or for missing/null linkage. */
async function maybeForkCatalogueItem(db, messageItemId, extra, finalPriceAfter) {
  const ctx = await db.query(
    `SELECT mi.id, mi.item_id, mi.name        AS mi_name,
            mi.description AS mi_description,
            mi.unit        AS mi_unit,
            mi.price_current,
            m.supplier_org_id,
            m.category_id  AS msg_category_id,
            i.org_id       AS item_org_id,
            i.is_active    AS item_is_active,
            i.category_id  AS item_category_id,
            i.name         AS item_name,
            i.description  AS item_description
       FROM message_items mi
       JOIN messages m ON m.id = mi.message_id
       LEFT JOIN items i ON i.id = mi.item_id
      WHERE mi.id = $1`,
    [messageItemId]
  );
  const row = ctx.rows[0];
  if (!row || !row.supplier_org_id || !row.item_id) return;
  // Already owned by the supplier? No fork.
  if (row.item_org_id === row.supplier_org_id) return;

  const newPrice = finalPriceAfter != null ? finalPriceAfter : row.price_current;
  const newName  = (extra && extra.name        != null) ? extra.name        : (row.mi_name        || row.item_name);
  const newDesc  = (extra && extra.description != null) ? extra.description : (row.mi_description || row.item_description);
  const newUnit  = (extra && extra.unit        != null) ? extra.unit        : row.mi_unit;
  const newImage = (extra && extra.imageUrl    != null) ? extra.imageUrl    : null;
  const categoryId = row.item_category_id || row.msg_category_id || null;

  const ins = await db.query(
    `INSERT INTO items (org_id, category_id, name, description, unit,
                        base_price, image_url, is_active, approval_status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, true, 'approved')
     RETURNING id`,
    [row.supplier_org_id, categoryId, newName, newDesc, newUnit, newPrice, newImage]
  );

  await db.query(
    'UPDATE message_items SET item_id = $1 WHERE id = $2',
    [ins.rows[0].id, messageItemId]
  );
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
    stay untouched.

    v1.65fW — also returns buyer_status / seller_status derived from
    the message_item_decisions satellite (latest row per side). The
    UI uses these to drive the two-sided handshake badges. */
async function getByMessage(messageId, { executor = null } = {}) {
  const db = executor || pool;
  const r = await db.query(
    `SELECT mi.*,
            i.image_url       AS item_image_url,
            i.image_display   AS item_image_display,
            o.id              AS supplier_org_id,
            o.name            AS supplier_name,
            o.logo_url        AS supplier_logo_url,
            buyer.decision    AS buyer_status,
            buyer.user_id     AS buyer_user_id,
            buyer.created_at  AS buyer_at,
            seller.decision   AS seller_status,
            seller.user_id    AS seller_user_id,
            seller.created_at AS seller_at
       FROM message_items mi
       LEFT JOIN items i ON i.id = mi.item_id
       LEFT JOIN orgs  o ON o.id = i.org_id
       LEFT JOIN LATERAL (
         SELECT d.decision, d.user_id, d.created_at
           FROM message_item_decisions d
          WHERE d.message_item_id = mi.id AND d.side = 'buyer'
          ORDER BY d.created_at DESC LIMIT 1
       ) buyer ON TRUE
       LEFT JOIN LATERAL (
         SELECT d.decision, d.user_id, d.created_at
           FROM message_item_decisions d
          WHERE d.message_item_id = mi.id AND d.side = 'seller'
          ORDER BY d.created_at DESC LIMIT 1
       ) seller ON TRUE
      WHERE mi.message_id = $1
      ORDER BY mi.created_at ASC`,
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
  if (decision !== 'accepted' && decision !== 'declined') {
    const err = new Error('decision must be accepted or declined'); err.status = 400; throw err;
  }
  const r = await db.query(
    `INSERT INTO message_item_decisions
       (message_item_id, side, decision, user_id, note)
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
      WHERE d.message_item_id = $1
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
