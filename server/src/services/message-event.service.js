// pV2-PROJECTS-S3 (rebuild) — the messaging/negotiation EVENT layer on the
// 0022 cluster (DATA-MODEL-REDESIGN §"Messaging / engagement cluster" +
// §"Approvals (FR-00228)"). Supersedes the UNIFY-01 message-item.service
// (transitionItem / recordDecision / aggregateStatus over message_items +
// message_item_decisions + message_item_events — all culled). That service
// stays DORMANT (still required by the v1 brief/messages routes); this is the
// rebuilt path.
//
// The locked model:
//   • message_events is APPEND-ONLY (insert only — no update/delete). One event
//     per (message × relation): the item's RESULTING status + price + changes.
//   • The ACTOR is DERIVED, not stored — it's the message's sender side
//     (messages.from_org_id === the agency ⇒ 'buyer', else 'seller').
//   • Per-line approval state is DERIVED from event ordering, never stored:
//     an accept is valid only if NO *material* event post-dates it (a price /
//     definitional / status change; a plain chat message is not material). So
//     "both accepted" / "awaiting <side>" / "needs re-approval" are COMPUTED.
//   • The current agreed FORM lives in the project_item_quotes OVERLAY (the SSOT
//     read via COALESCE(quote, project_items)); the events are the journal.
//
// This module is pure logic + two tiny writers. The thread-assembly reads live
// in inbox.service. deriveLineState() reproduces the exact client DTO vocabulary
// (brief_sent / adjusted_by_{agent,supplier} / accepted / declined_by_{…} +
// buyerAccepted/sellerAccepted + *AcceptedAt), so the ported inbox UI consumes
// it unchanged.

// ── resulting-status vocabulary (stored on message_events.status; TEXT,
//    validated here — the DDL leaves status app-governed, no DB CHECK) ─────────
const LINE_STATUS = {
  BRIEF_SENT: 'brief_sent',              // baseline: briefed, no response yet (event 0 = the frozen ask)
  ADJUSTED_BY_AGENT: 'adjusted_by_agent',
  ADJUSTED_BY_SUPPLIER: 'adjusted_by_supplier',
  ACCEPTED: 'accepted',
  DECLINED_BY_AGENT: 'declined_by_agent',
  DECLINED_BY_SUPPLIER: 'declined_by_supplier',
  BOOKED: 'booked',                      // S4 (sign + pay); not emitted in S3
};

/** The three negotiation actions a reply can carry (the route enum). */
const ACTIONS = new Set(['accept', 'adjust', 'decline']);

/** Map an action + the actor's side → the RESULTING line status stored on the
 *  event. side: 'buyer' (agency) | 'seller' (supplier). */
function statusFor(action, side) {
  if (action === 'accept') return LINE_STATUS.ACCEPTED;
  if (action === 'decline') return side === 'buyer' ? LINE_STATUS.DECLINED_BY_AGENT : LINE_STATUS.DECLINED_BY_SUPPLIER;
  if (action === 'adjust') return side === 'buyer' ? LINE_STATUS.ADJUSTED_BY_AGENT : LINE_STATUS.ADJUSTED_BY_SUPPLIER;
  return null;
}

/** The action kind encoded by a resulting status (prefix rule — a new
 *  declined_ or adjusted_ value can't be missed; mirrors line-total.util's
 *  isDeclined prefix discipline). */
function kindOf(status) {
  if (!status) return null;
  if (status.startsWith('declined')) return 'decline';
  if (status.startsWith('adjusted')) return 'adjust';
  if (status === 'accepted') return 'accept';
  if (status === 'booked') return 'book';
  return null;
}

/** A *material* event invalidates a prior accept (FR-00228). Price / definitional
 *  (adjust) and status changes (decline / cancel / book) are material; nothing
 *  else reaches message_events, so every stored event is material. A plain chat
 *  message writes NO event, so it never clears an accept — exactly the rule. */
function isMaterial(status) {
  return kindOf(status) != null;
}

/**
 * Replay a line's ordered events into the client's negotiation DTO fields. The
 * baseline (event 0) is the frozen project_items ask → 'brief_sent' once briefed.
 *
 * Reproduces the old reply()+recordDecision semantics so the ported UI is
 * byte-for-byte compatible:
 *   • accept  → that side accepts the current terms.
 *   • adjust  → proposing a new cost IS accepting it (own side accepted) AND
 *               CLEARS the other side's prior accept (re-approval needed).
 *   • decline → that side declines (terminal pill; action bar stays).
 * buyer = agency, seller = supplier.
 *
 * @param events ordered ASC: [{ status, side: 'buyer'|'seller', createdAt, note,
 *                               priceCurrent, priceOverride, changes }]
 * @param opts.briefed whether a brief relation exists (→ 'brief_sent' baseline;
 *                     false ⇒ 'to_send', never surfaced in a thread)
 * @returns { status, buyerAccepted, sellerAccepted, buyerAcceptedAt,
 *            sellerAcceptedAt, clearedBy } — clearedBy = the event that last
 *            cleared an accept (drives "re-approval needed: supplier raised …").
 */
function deriveLineState(events, { briefed = true } = {}) {
  let status = briefed ? LINE_STATUS.BRIEF_SENT : 'to_send';
  let buyer = null;   // 'accepted' | 'declined' | 'cleared' | null
  let seller = null;
  let buyerAt = null;
  let sellerAt = null;
  let clearedBy = null; // the most recent event that invalidated an accept

  for (const e of events) {
    const kind = kindOf(e.status);
    if (!kind) continue;
    const side = e.side; // authoritative — derived from the message sender
    if (kind === 'accept') {
      // A re-accept by the side whose standing accept was CLEARED resolves the
      // invalidation → drop clearedBy, else a re-approval note lingers after the
      // line is settled again (bothAccepted with a stale clearedBy). (audit LM1)
      if (side === 'buyer') {
        if (buyer === 'cleared') clearedBy = null;
        buyer = 'accepted'; buyerAt = e.createdAt;
      } else {
        if (seller === 'cleared') clearedBy = null;
        seller = 'accepted'; sellerAt = e.createdAt;
      }
      status = LINE_STATUS.ACCEPTED;
    } else if (kind === 'decline') {
      if (side === 'buyer') buyer = 'declined'; else seller = 'declined';
      status = side === 'buyer' ? LINE_STATUS.DECLINED_BY_AGENT : LINE_STATUS.DECLINED_BY_SUPPLIER;
    } else if (kind === 'adjust') {
      // Proposing a new cost accepts it for the proposer and CLEARS the other
      // side's standing accept (FR-00228 — a material event post-dates it).
      if (side === 'buyer') {
        buyer = 'accepted'; buyerAt = e.createdAt;
        if (seller === 'accepted') clearedBy = e;
        seller = seller === 'accepted' ? 'cleared' : seller; sellerAt = null;
        status = LINE_STATUS.ADJUSTED_BY_AGENT;
      } else {
        seller = 'accepted'; sellerAt = e.createdAt;
        if (buyer === 'accepted') clearedBy = e;
        buyer = buyer === 'accepted' ? 'cleared' : buyer; buyerAt = null;
        status = LINE_STATUS.ADJUSTED_BY_SUPPLIER;
      }
    } else if (kind === 'book') {
      status = LINE_STATUS.BOOKED;
    }
  }

  return {
    status,
    buyerAccepted: buyer === 'accepted',
    sellerAccepted: seller === 'accepted',
    buyerAcceptedAt: buyer === 'accepted' ? buyerAt : null,
    sellerAcceptedAt: seller === 'accepted' ? sellerAt : null,
    clearedBy,
  };
}

/** Append one message_event (append-only; UNIQUE(message_id, message_relation_id)
 *  → one event per item per message). Runs on a caller-owned txn client. */
async function writeEvent(client, {
  messageId, relationId, status,
  priceCurrent = null, priceOverride = null, changes = null,
  reasonCode = null, note = null, userId = null,
}) {
  await client.query(
    `INSERT INTO message_events
       (message_id, message_relation_id, status, price_current, price_override,
        changes, reason_code, note, created_by)
     VALUES ($1, $2, $3, $4, $5, COALESCE($6::jsonb, '{}'::jsonb), $7, $8, $9)`,
    [messageId, relationId, status,
     priceCurrent, priceOverride,
     changes == null ? null : JSON.stringify(changes),
     reasonCode, note, userId]
  );
}

// The provider-overlay columns a negotiation touches (the current agreed form).
// NULL-means-inherit: only populated fields override the frozen project_items.
const OVERLAY_COLS = {
  priceCurrent: 'price_current',
  priceOverride: 'price_override',
  installCost: 'install_cost',
  status: 'status',
  declineReason: 'decline_reason',
};

/** Upsert the provider's overlay row (project_item_id × project_provider_id) and
 *  set the given fields. This is the SSOT of the current negotiated form; the
 *  populated fields ARE the changelog. price_current / price_override are
 *  mutually exclusive (the CHECK on the table) — setting one clears the other.
 *  Runs on a caller-owned txn client. org_id = the OWNING agency (never a body). */
async function upsertOverlay(client, { projectItemId, providerId, orgId, fields }) {
  const existing = await client.query(
    `SELECT id FROM project_item_quotes
      WHERE project_item_id = $1 AND project_provider_id = $2 AND deleted_at IS NULL
      FOR UPDATE`,
    [projectItemId, providerId]
  );
  // Enforce the per-unit / flat XOR before touching the row.
  const f = { ...fields };
  if (f.priceCurrent != null) f.priceOverride = null;
  else if (f.priceOverride != null) f.priceCurrent = null;
  const keys = Object.keys(f).filter((k) => k in OVERLAY_COLS && f[k] !== undefined);
  if (!keys.length && existing.rows.length) return existing.rows[0].id;

  if (existing.rows.length) {
    const sets = keys.map((k, i) => `${OVERLAY_COLS[k]} = $${i + 2}`);
    await client.query(
      `UPDATE project_item_quotes SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $1`,
      [existing.rows[0].id, ...keys.map((k) => f[k])]
    );
    return existing.rows[0].id;
  }
  const cols = keys.map((k) => OVERLAY_COLS[k]);
  const place = keys.map((_, i) => `$${i + 4}`);
  const ins = await client.query(
    `INSERT INTO project_item_quotes
       (org_id, project_item_id, project_provider_id${cols.length ? ', ' + cols.join(', ') : ''})
     VALUES ($1, $2, $3${place.length ? ', ' + place.join(', ') : ''})
     RETURNING id`,
    [orgId, projectItemId, providerId, ...keys.map((k) => f[k])]
  );
  return ins.rows[0].id;
}

module.exports = {
  LINE_STATUS, ACTIONS, statusFor, kindOf, isMaterial, deriveLineState,
  writeEvent, upsertOverlay,
};
