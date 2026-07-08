// pV2-INBOX-01 — gated v2 inbox façade service.
//
// Threads are stored in v1's exact (project_id, supplier_org_id,
// category_id) shape (messages + message_items + decisions + events) —
// no migration, no schema change. This service is the v2 read path over
// that data; identity is ALWAYS the caller's org (RP-INB1): every query
// filters by the org_id the route reads from the JWT, never a
// client-supplied id, and there is NO ballpark cross-org override.
//
// Slice 1 (supplier entry): the projects an agency has reached out to
// THIS supplier about, shaped as the existing ProjectCard so the
// /projects?bucket=quoting screen renders them with the agency
// project-card grid (Defer 1 — a bespoke supplier card comes later).

const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');
const TaxonomyService = require('./taxonomy.service');
const messageService = require('./message.service');
const { getByMessage, aggregateStatus, transitionItem, recordDecision } = require('./message-item.service');

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

/** Map a supplier-projects row to the ProjectCard contract
 *  (client-v2 core/projects/project.types.ts). The reaching-out agency
 *  is the supplier's counterparty, so it lands where the agency card
 *  shows the client; the headline total is the supplier's running quote
 *  value for the project. */
function toSupplierProjectCard(row) {
  return {
    id: row.id,
    // v1 card title = event_name with a name fallback.
    name: row.event_name || row.name,
    ref: row.ref,
    status: row.status ?? 'active',
    coverUrl: row.cover_image_url,
    coverFocalX: row.cover_focal_x ?? 50,
    coverFocalY: row.cover_focal_y ?? 50,
    iconName: row.icon_name ?? null,
    iconColor: row.icon_color ?? null,
    unsplashPhotographerName: row.unsplash_photographer_name ?? null,
    unsplashPhotoUrl: row.unsplash_photo_url ?? null,
    // The agency that reached out → the cover chip (who's asking).
    clientName: row.agency_name ?? null,
    clientLogoUrl: row.agency_logo_url ?? null,
    // Supplier headline = their running quote total for this project.
    ballparkCost: row.quote_total == null ? null : Number(row.quote_total),
    currency: row.currency ?? 'GBP',
    // NOTE(pV2-INBOX-01 QC): the agency card renders this as "{n}
    // suppliers". For the supplier view it carries the count of THEIR
    // quoted items in the project — the label wants parameterising (or a
    // bespoke supplier card, Defer 1). Flagged for Liam.
    supplierCount: Number(row.item_count ?? 0),
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** Every project the caller-supplier has been messaged about, newest
 *  activity first. One row per project: the reaching-out agency, the
 *  count of the supplier's quoted items, and their running quote total.
 *  Items hang off the brief message; replies only transition them, so
 *  SUM/COUNT across the project's messages is the project total. */
async function listSupplierProjects(supplierOrgId) {
  const r = await pool.query(
    `SELECT p.id, p.name, p.event_name, p.ref, p.status,
            p.cover_image_url, p.cover_focal_x, p.cover_focal_y,
            p.icon_name, p.icon_color,
            p.unsplash_photographer_name, p.unsplash_photo_url,
            p.currency, p.created_at,
            ao.name      AS agency_name,
            ao.logo_url  AS agency_logo_url,
            MAX(m.updated_at)                  AS updated_at,
            COUNT(DISTINCT mi.id)              AS item_count,
            COALESCE(SUM(mi.price_current), 0) AS quote_total
       FROM messages m
       JOIN projects p   ON p.id  = m.project_id
       LEFT JOIN orgs ao ON ao.id = p.org_id
       LEFT JOIN message_items mi
              ON mi.message_id = m.id AND mi.deleted_at IS NULL
      WHERE m.supplier_org_id = $1
        AND m.deleted_at IS NULL
      GROUP BY p.id, ao.name, ao.logo_url
      ORDER BY MAX(m.updated_at) DESC NULLS LAST`,
    [supplierOrgId]
  );
  return r.rows.map(toSupplierProjectCard);
}

/** Resolve (or lazily create) the project_categories row for a project's
 *  catalogue category — messages.category_id FKs to project_categories(id),
 *  so the thread keys per (project, supplier, category). v2 quote items
 *  normally already carry a project_categories row (recommend creates it);
 *  the INSERT is the rare fallback. */
async function resolveProjectCategoryId(executor, projectId, categoryId) {
  const found = await executor.query(
    `SELECT id FROM project_categories
      WHERE project_id = $1 AND category_id = $2 AND is_active = true
      ORDER BY created_at ASC LIMIT 1`,
    [projectId, categoryId]
  );
  if (found.rows.length) return found.rows[0].id;
  const ins = await executor.query(
    `INSERT INTO project_categories (project_id, category_id, status_code)
     VALUES ($1, $2, 'draft') RETURNING id`,
    [projectId, categoryId]
  );
  return ins.rows[0].id;
}

/** pV2-INBOX-02 — fan a project's quote out to the agent-picked suppliers.
 *
 *  The agency org is the JWT caller (RP-INB1): we verify it owns the project
 *  before any write. For each (category → supplierIds) in the roster we build
 *  the requirements from the project's quote items in that category, then
 *  reuse the v1 `requestQuotes` writes (one outbound thread per supplier,
 *  seeded `brief_sent` message_items + events + quote_requests + the outreach
 *  email) with `skip_balls` — v2 has no Balls economy yet. */
async function sendOutreach({ agencyOrgId, userId, projectId, roster }) {
  const proj = await pool.query(
    `SELECT org_id FROM projects WHERE id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  if (!proj.rows.length) throw httpErr('Project not found', 404);
  // Participation: only the owning agency may fan its own project out.
  if (proj.rows[0].org_id !== agencyOrgId) throw httpErr('Project not found', 404);

  // The quote's item ids grouped by catalogue category — but only items not
  // already out for quote. Without this, a second send (after adding items)
  // re-sweeps the whole category and re-briefs an already-sent item to a
  // different supplier (e.g. Supplier B's Catering brief picking up Supplier
  // A's already-sent dish). The dialog scopes to "to send"; the server must too.
  const itemsRes = await pool.query(
    `SELECT i.category_id, pi.item_id
       FROM project_items pi
       JOIN items i ON i.id = pi.item_id
      WHERE pi.project_id = $1 AND pi.deleted_at IS NULL
        AND NOT EXISTS (
          SELECT 1 FROM message_items mi
            JOIN messages m ON m.id = mi.message_id
           WHERE m.project_id = pi.project_id
             AND m.direction = 'outbound'
             AND mi.item_id = pi.item_id
             AND mi.deleted_at IS NULL)`,
    [projectId]
  );
  const itemsByCat = new Map();
  for (const r of itemsRes.rows) {
    const arr = itemsByCat.get(r.category_id) ?? [];
    arr.push(r.item_id);
    itemsByCat.set(r.category_id, arr);
  }

  const results = [];
  for (const entry of roster) {
    const categoryId = entry.categoryId;
    const supplierIds = [...new Set((entry.supplierIds || []).filter(Boolean))];
    const itemIds = itemsByCat.get(categoryId) || [];
    // Nothing to ask, or no one to ask — skip (e.g. a stale roster category).
    if (!supplierIds.length || !itemIds.length) continue;

    const projectCategoryId = await resolveProjectCategoryId(pool, projectId, categoryId);
    const res = await TaxonomyService.requestQuotes({
      project_id: projectId,
      category_id: categoryId,
      project_category_id: projectCategoryId,
      requirements: itemIds.map((item_id) => ({ item_id })),
      supplier_ids: supplierIds,
      user_id: userId,
      skip_balls: true,
    });
    results.push({ categoryId, refCode: res.ref_code, suppliers: res.suppliers, requirements: res.requirements });
  }

  return {
    categories: results.length,
    threads: results.reduce((n, r) => n + (r.suppliers || 0), 0),
    results,
  };
}

/** Map a message row to a conversation bubble from the VIEWER's point of
 *  view. Supplier: their inbound replies are "mine"; the agency's outbound
 *  brief is incoming. Agency: the reverse. The counterparty name labels the
 *  incoming bubbles. */
function toBubble(m, viewer, counterpartyName, taggedItemIds) {
  const mine = viewer === 'supplier' ? m.direction === 'inbound' : m.direction === 'outbound';
  return {
    id: m.id,
    mine,
    author: mine ? 'You' : counterpartyName || (viewer === 'supplier' ? 'Agency' : 'Supplier'),
    body: m.body || '',
    createdAt: m.created_at,
    // catalogue item_ids this message is tagged to (empty = thread-level
    // broadcast). The brief carries all its items, so it shows in every
    // item filter (pV2-INBOX-04).
    taggedItemIds: taggedItemIds ?? [],
  };
}

/** Per-message tags: catalogue item_ids each message carries a message_items
 *  row for (the brief's real items + the pure-tag rows on replies). */
async function fetchTags(messageIds) {
  if (!messageIds.length) return new Map();
  const r = await pool.query(
    `SELECT message_id, item_id FROM message_items
      WHERE message_id = ANY($1::uuid[]) AND item_id IS NOT NULL AND deleted_at IS NULL`,
    [messageIds]
  );
  const map = new Map();
  for (const row of r.rows) {
    const arr = map.get(row.message_id) ?? [];
    arr.push(row.item_id);
    map.set(row.message_id, arr);
  }
  return map;
}

function toThreadItem(it) {
  return {
    id: it.id,
    // The catalogue item_id — the tag-match key for filtering messages.
    itemId: it.item_id ?? null,
    name: it.name,
    description: it.description || null,
    status: it.status,
    priceRef: it.price_ref == null ? null : Number(it.price_ref),
    priceCurrent: it.price_current == null ? null : Number(it.price_current),
    imageUrl: it.item_image_url ?? null,
    // Latest decision per side (from message_item_decisions) — drives the
    // YOU / THEY / BOTH accepted pill (buyer = agency, seller = supplier).
    buyerAccepted: it.buyer_status === 'accepted',
    sellerAccepted: it.seller_status === 'accepted',
  };
}

/** pV2-INBOX-01 — the caller-supplier's inbox for one project: a project
 *  summary card (client · event date · location · agency · original/revised
 *  totals) plus the per-category conversation threads (items + bubbles).
 *  org from JWT only (RP-INB1): we read the supplier's own feed and never
 *  trust a client id. */
async function getSupplierThreads(supplierOrgId, projectId) {
  const all = await messageService.getAllForSupplier(supplierOrgId);
  const scoped = all.filter((m) => m.project_id === projectId);

  // Group by category (rows arrive created_at ASC, so the first seen per
  // category is the lead brief — its message_items are the thread's items).
  const groups = new Map();
  for (const m of scoped) {
    const key = m.category_id ?? '';
    let g = groups.get(key);
    if (!g) {
      g = { categoryId: m.category_id, lead: m, messages: [] };
      groups.set(key, g);
    }
    g.messages.push(m);
  }

  const tags = await fetchTags(scoped.map((m) => m.id));
  const threads = [];
  for (const g of groups.values()) {
    const items = await getByMessage(g.lead.id);
    threads.push(makeThread(g.lead, g.messages, items, 'supplier', tags));
  }
  sortThreads(threads);
  const project = await getProjectSummary(projectId, threads);
  return { project, threads };
}

/** Build one thread object from the VIEWER's perspective. Carries both the
 *  agency and supplier identities (the client picks the counterparty); the
 *  bubbles + aggregate status are mapped for the viewer. */
function makeThread(lead, msgs, items, viewer, tagsByMessage) {
  const counterpartyName = viewer === 'supplier' ? lead.agency_name : lead.supplier_name;
  return {
    id: lead.id,
    categoryId: lead.category_id ?? null,
    categoryName: lead.category_name || null,
    agencyOrgId: lead.agency_org_id ?? null,
    agencyName: lead.agency_name ?? null,
    agencyLogoUrl: lead.agency_logo_url ?? null,
    supplierOrgId: lead.supplier_org_id ?? null,
    supplierName: lead.supplier_name ?? null,
    supplierLogoUrl: lead.supplier_logo_url ?? null,
    projectId: lead.project_id,
    projectName: lead.project_name ?? null,
    refCode: lead.ref_code ?? null,
    status: aggregateStatus(items, viewer === 'supplier' ? 'supplier' : 'agent'),
    total: items.reduce((s, it) => s + Number(it.price_current ?? it.price_ref ?? 0), 0),
    originalTotal: items.reduce((s, it) => s + Number(it.price_ref ?? 0), 0),
    revisedTotal: items.reduce((s, it) => s + Number(it.price_current ?? it.price_ref ?? 0), 0),
    items: items.map(toThreadItem),
    // Empty-body rows carry no conversation (e.g. an action-only reply) —
    // never render a blank bubble.
    messages: msgs
      .filter((m) => (m.body || '').trim())
      .map((m) => toBubble(m, viewer, counterpartyName, tagsByMessage?.get(m.id))),
  };
}

/** Newest-active thread first. */
function sortThreads(threads) {
  threads.sort((a, b) => {
    const am = a.messages[a.messages.length - 1]?.createdAt ?? 0;
    const bm = b.messages[b.messages.length - 1]?.createdAt ?? 0;
    return new Date(bm) - new Date(am);
  });
}

/** The project summary card (client · event date · location · agency ·
 *  original/revised totals across the supplier's items). */
async function getProjectSummary(projectId, threads) {
  const allItems = threads.flatMap((t) => t.items);
  const ctx = await pool.query(
    `SELECT COALESCE(p.event_name, p.name) AS project_name,
            p.event_date, p.venue_city, p.venue_name,
            cl.name AS client_name,
            ag.name AS agency_name, ag.logo_url AS agency_logo_url
       FROM projects p
       LEFT JOIN clients cl ON cl.id = p.client_id
       LEFT JOIN orgs    ag ON ag.id = p.org_id
      WHERE p.id = $1`,
    [projectId]
  );
  const row = ctx.rows[0] || {};
  return {
    id: projectId,
    name: row.project_name ?? threads[0]?.projectName ?? null,
    clientName: row.client_name ?? null,
    eventDate: row.event_date ?? null,
    location: row.venue_city || row.venue_name || null,
    agencyName: row.agency_name ?? threads[0]?.agencyName ?? null,
    agencyLogoUrl: row.agency_logo_url ?? null,
    itemCount: allItems.length,
    originalTotal: allItems.reduce((s, it) => s + Number(it.priceRef ?? 0), 0),
    revisedTotal: allItems.reduce((s, it) => s + Number(it.priceCurrent ?? it.priceRef ?? 0), 0),
  };
}

/** pV2-INBOX-03 — the agent inbox for one project: every supplier thread
 *  (per supplier × category), agent perspective. org from JWT — we verify
 *  the caller's agency owns the project (RP-INB1). */
async function getAgentThreads(agencyOrgId, projectId) {
  const proj = await pool.query(
    `SELECT org_id FROM projects WHERE id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  if (!proj.rows.length || proj.rows[0].org_id !== agencyOrgId) throw httpErr('Project not found', 404);

  const all = await messageService.getAll(projectId);
  const groups = new Map();
  for (const m of all) {
    const key = `${m.supplier_org_id ?? ''}|${m.category_id ?? ''}`;
    let g = groups.get(key);
    if (!g) {
      g = { lead: m, messages: [] };
      groups.set(key, g);
    }
    g.messages.push(m);
  }

  const tags = await fetchTags(all.map((m) => m.id));
  const threads = [];
  for (const g of groups.values()) {
    const items = await getByMessage(g.lead.id);
    threads.push(makeThread(g.lead, g.messages, items, 'agency', tags));
  }
  sortThreads(threads);
  const project = await getProjectSummary(projectId, threads);
  return { project, threads };
}

/** pV2-INBOX-01 — the caller-supplier replies in a thread: a chat message
 *  and/or per-item actions (Accept / Propose-new-price / Decline). Identity
 *  is the JWT caller; we verify the thread (its lead brief) belongs to this
 *  supplier (RP-INB1). Reuses message-item.service transitions + decisions;
 *  one transaction (Hygiene Rule 1). Item state lives on the lead's
 *  message_items — the reply row is just the bubble (v1 model). */
async function reply({ viewer, orgId, userId, threadId, text, itemActions, taggedItemId }) {
  const isSupplier = viewer !== 'agency';
  const lead = await pool.query(
    `SELECT id, project_id, supplier_org_id, category_id, category_name,
            supplier_name, subject, ref_code
       FROM messages WHERE id = $1 AND deleted_at IS NULL`,
    [threadId]
  );
  if (!lead.rows.length) throw httpErr('Thread not found', 404);
  const lm = lead.rows[0];
  // Participation (RP-INB1): supplier owns the thread; agency owns the
  // project. Not-found and not-yours are the same 404 (no disclosure).
  if (isSupplier) {
    if (lm.supplier_org_id !== orgId) throw httpErr('Thread not found', 404);
  } else {
    const proj = await pool.query(`SELECT org_id FROM projects WHERE id = $1 AND deleted_at IS NULL`, [lm.project_id]);
    if (!proj.rows.length || proj.rows[0].org_id !== orgId) throw httpErr('Thread not found', 404);
  }

  const actions = Array.isArray(itemActions) ? itemActions : [];
  const hasText = !!(text && String(text).trim());
  if (!hasText && !actions.length) throw httpErr('reply needs text or item actions', 400);

  // Viewer-specific shaping (mirrors v1's /:id/reply): supplier replies are
  // inbound + unread; agency replies are outbound + sent. Item transitions
  // record the actor's side; an adjust clears the OTHER side's prior accept.
  const direction = isSupplier ? 'inbound' : 'outbound';
  const msgStatus = isSupplier ? 'unread' : 'sent';
  const readFlag = isSupplier ? false : true;
  const actorType = isSupplier ? 'supplier' : 'agent';
  const mySide = isSupplier ? 'seller' : 'buyer';
  const otherSide = isSupplier ? 'buyer' : 'seller';
  const adjustStatus = isSupplier ? 'adjusted_by_supplier' : 'adjusted_by_agent';
  const declineStatus = isSupplier ? 'declined_by_supplier' : 'declined_by_agent';

  return withTransaction(async (db) => {
    // Only a message with real text becomes a bubble — an action-only reply
    // does its item transitions without leaving a blank bubble.
    let replyId = null;
    if (hasText) {
      const ins = await db.query(
        `INSERT INTO messages
           (project_id, user_id, supplier_org_id, category_id, category_name,
            supplier_name, subject, body, direction, msg_status, read, next_action_by, ref_code)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, $12)
         RETURNING id`,
        [lm.project_id, userId || null, lm.supplier_org_id, lm.category_id,
         lm.category_name, lm.supplier_name,
         `Re: ${lm.subject || lm.ref_code || ''}`,
         text, direction, msgStatus, readFlag, lm.ref_code]
      );
      replyId = ins.rows[0].id;
    }

    // Items this reply is tagged to → a pure message_items row per item
    // (item_id only; INBOX.md #10, no schema change). Actions tag their
    // item; an item-selected chat tags via taggedItemId. catalogue item_id
    // → display name.
    const tagItems = new Map();

    const changes = [];
    for (const a of actions) {
      const { itemId, action, price, note } = a || {};
      if (!itemId || !action) continue;
      // The item must belong to THIS thread's brief (lead message).
      const before = await db.query(
        `SELECT name, price_current, status, item_id FROM message_items
          WHERE id = $1 AND message_id = $2`,
        [itemId, lm.id]
      );
      if (!before.rows.length) continue;
      const b = before.rows[0];
      if (b.item_id) tagItems.set(b.item_id, b.name);

      let toStatus = null;
      let extra = null;
      switch (action) {
        case 'accept':  toStatus = 'accepted'; break;
        case 'adjust':  toStatus = adjustStatus; extra = { price }; break;
        case 'decline': toStatus = declineStatus; break;
        default: continue;
      }

      const result = await transitionItem({
        itemId,
        toStatus,
        actor: { type: actorType, id: userId || null },
        note: note || null,
        priceBefore: b.price_current,
        priceAfter: action === 'adjust' && price != null ? price : null,
        extra,
        executor: db,
      });

      if (action === 'accept' || action === 'decline') {
        await recordDecision({
          messageItemId: itemId,
          side: mySide,
          decision: action === 'accept' ? 'accepted' : 'declined',
          userId: userId || null,
          note: note || null,
          executor: db,
        });
      } else if (action === 'adjust') {
        // Proposing a new cost IS accepting it — record the proposer's side
        // as accepted (Liam 2026-06-29). The OTHER side's prior accept is
        // cleared; they must accept the new cost (then it's BOTH ACCEPTED).
        await recordDecision({
          messageItemId: itemId,
          side: mySide,
          decision: 'accepted',
          userId: userId || null,
          note: 'auto-accepted own proposed cost',
          executor: db,
        });
        await recordDecision({
          messageItemId: itemId,
          side: otherSide,
          decision: 'cleared',
          userId: userId || null,
          note: `auto-cleared — ${actorType} edited`,
          executor: db,
        });
      }
      changes.push({ name: b.name, from: b.status, to: result.toStatus });
    }

    // A chat message composed with an item selected (no action) tags that
    // item too.
    if (taggedItemId && !tagItems.has(taggedItemId)) {
      const nm = await db.query(
        `SELECT name FROM message_items WHERE message_id = $1 AND item_id = $2 LIMIT 1`,
        [lm.id, taggedItemId]
      );
      if (nm.rows.length) tagItems.set(taggedItemId, nm.rows[0].name);
    }

    // Write the tag rows on the reply bubble (skip if no bubble was made).
    if (replyId) {
      for (const [itemId, name] of tagItems) {
        await db.query(
          `INSERT INTO message_items (message_id, item_id, name) VALUES ($1, $2, $3)`,
          [replyId, itemId, name]
        );
      }
    }

    return { ok: true, replyId, changes };
  });
}

module.exports = { listSupplierProjects, sendOutreach, getSupplierThreads, getAgentThreads, reply };
