// pV2-PROJECTS-S3 (rebuild) — the inbox / messaging / negotiation READ+WRITE
// layer on the 0022 messaging cluster. Supersedes the UNIFY-01 inbox.service
// that read the single merged line-state table (message_items + project_items
// price/status columns + message_item_decisions — all culled in the rebuild).
//
// The locked model (DATA-MODEL-REDESIGN §"Messaging / engagement cluster" +
// §"Line cluster" + §"Approvals FR-00228"):
//   • project_providers   — the engagement SPINE (one row per supplier engaged
//                           on a project; UNIQUE(project, provider), revived on
//                           re-engagement). Backs the inbox home.
//   • messages            — party-anchored (from_org / to_org); body NULL = an
//                           action (a bare Accept), not a chat bubble.
//   • message_relations   — what a message is ABOUT (→ project_item).
//   • message_events      — APPEND-ONLY journal (accept/decline/suggest →
//                           resulting status + price + changes).
//   • project_item_quotes — the per-provider OVERLAY: the current agreed form
//                           (NULL = inherit from the frozen project_items ask).
// The "thread" is DERIVED (no table): grouped by (provider × project_category);
// threadId = the earliest (brief) message in that group. Per-line approval state
// (brief_sent / adjusted_by_{agent,supplier} / accepted / declined + buyer/
// sellerAccepted) is DERIVED from event ordering (message-event.service
// deriveLineState) — NOT stored — reproducing the exact client DTO vocabulary so
// the ported inbox UI consumes it unchanged. Single-write-path invariant: every
// state change writes BOTH an event (journal) and the overlay (current form).
//
// SECURITY: org_id is ALWAYS the JWT caller's (routes pass req.user.org_id); the
// per-request pinned client carries the org GUC, so RLS scopes every read/write
// to the caller. Cross-org reads use the sanctioned directories: supplier_directory
// (agency→supplier display) and org_contact() (supplier→agency display, 0023).

const pool = require('../db/pool');
const { withTransaction } = require('../db/with-transaction');
const { lineTotal } = require('./line-pricing');
const { isDeclined } = require('./line-total.util');
const projectLine = require('./project-line.service');
const mev = require('./message-event.service');
const codelistSvc = require('./codelist.service');

/** code → meta.needs for item_unit (e.g. 'platter' → 'serves'). Drives the
 *  unit-size lookup off the CODELIST, not a hardcoded unit code, so it keeps
 *  working if the code is relabelled or more units gain a size. meta.needs names
 *  the items column ('serves'/'time_unit'/'size'). */
async function unitNeedsMap() {
  const vals = await codelistSvc.values('item_unit');
  return new Map(vals.map((v) => [v.code, v.meta?.needs ?? null]));
}

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// ── cross-org counterparty display ───────────────────────────────────────────
// Agency viewer → the engaged SUPPLIER's card (supplier_directory, owner-run).
// Supplier viewer → the AGENCY's card (org_contact — a SECURITY DEFINER gated to
// a shared engagement; 0023). orgs RLS is own-org-only, so neither side can read
// the other's orgs row directly — these are the audited bypasses.
async function fetchOrgDisplay(viewer, orgIds) {
  const ids = [...new Set((orgIds || []).filter(Boolean))];
  const map = new Map();
  if (!ids.length) return map;
  const sql =
    viewer === 'agency'
      ? `SELECT id, name, logo_url, city FROM supplier_directory WHERE id = ANY($1::uuid[])`
      : `SELECT o.id, c.name, c.logo_url, c.city
           FROM unnest($1::uuid[]) o(id)
           LEFT JOIN LATERAL public.org_contact(o.id) c ON true`;
  const r = await pool.query(sql, [ids]);
  for (const row of r.rows) map.set(row.id, { name: row.name, logoUrl: row.logo_url, city: row.city });
  return map;
}

// ── thread assembly (shared by agency + supplier views) ──────────────────────

/** Totals for one resolved line via the pricing SSOT MODULE (single-line path —
 *  WORKING_STANDARDS: the module for single lines, lineTotalSql for set-based).
 *  Original = the frozen ask (base guide + tiers + frozen install); Revised =
 *  the provider overlay (negotiated per-unit / flat override + resolved qty/
 *  install). Golden-test-backed parity with the estimate cascade. */
function lineTotals(row) {
  const tiers = Array.isArray(row.price_tiers) ? row.price_tiers : null;
  const upcharge = row.f_variant && row.f_variant.upcharge ? Number(row.f_variant.upcharge) : 0;
  const original = lineTotal({
    basePrice: row.f_base, priceTiers: tiers, quantity: row.f_qty,
    installed: row.installed, installCost: row.f_ic ?? row.i_ic, installUnit: row.f_iu ?? row.i_iu,
    variantUpcharge: upcharge, honourFlat: false,
  });
  const revised = lineTotal({
    priceCurrent: row.q_current, basePrice: row.f_base, priceTiers: tiers, quantity: row.r_qty,
    installed: row.installed, installCost: row.r_ic ?? row.i_ic, installUnit: row.r_iu ?? row.i_iu,
    variantUpcharge: upcharge, flatTotal: row.q_override, honourFlat: true,
  });
  return { original, revised };
}

/** Resolve a set of project_items against ONE provider's overlay, with the raw
 *  columns lineTotals() needs. Frozen (f_*) + resolved (r_*) + overlay quote
 *  (q_*) + live item (i_*) side by side. */
async function resolvedLines(projectItemIds, providerId) {
  if (!projectItemIds.length) return new Map();
  const r = await pool.query(
    `SELECT pi0.id, pi0.item_id, pi0.project_category_id, pi0.parent_id,
            pi0.base_price AS f_base, pi0.quantity AS f_qty, pi0.variant AS f_variant,
            pi0.installed AS installed, pi0.install_cost AS f_ic, pi0.install_unit AS f_iu,
            COALESCE(q.name, pi0.name)               AS name,
            COALESCE(q.description, pi0.description)  AS description,
            COALESCE(q.image_url, pi0.image_url)      AS image_url,
            COALESCE(q.unit, pi0.unit)                AS unit,
            COALESCE(q.quantity, pi0.quantity)        AS r_qty,
            COALESCE(q.variant, pi0.variant)          AS r_variant,
            COALESCE(q.install_cost, pi0.install_cost) AS r_ic,
            COALESCE(q.install_unit, pi0.install_unit) AS r_iu,
            q.price_current AS q_current, q.price_override AS q_override,
            i.install_cost AS i_ic, i.install_unit AS i_iu,
            i.serves AS i_serves, i.time_unit AS i_time_unit, i.ref AS i_ref,
            i.attributes -> 'price_tiers' AS price_tiers
       FROM project_items pi0
       LEFT JOIN project_item_quotes q
         ON q.project_item_id = pi0.id AND q.project_provider_id = $2 AND q.deleted_at IS NULL
       LEFT JOIN items i ON i.id = pi0.item_id
      WHERE pi0.id = ANY($1::uuid[]) AND pi0.deleted_at IS NULL`,
    [projectItemIds, providerId]
  );
  const map = new Map();
  for (const row of r.rows) map.set(row.id, row);
  return map;
}

/** Batched sibling of resolvedLines: resolve MANY (item, engagement) PAIRS in ONE
 *  query (each item against its own provider overlay), for the set-based inbox
 *  summary. Same columns lineTotals() reads. Keyed `${itemId}|${engagementId}`.
 *  (Liam 2026-11-19 — inbox landing was a per-project per-provider N-query assembly.) */
async function resolvedLinesForPairs(itemIds, engagementIds) {
  if (!itemIds.length) return new Map();
  const r = await pool.query(
    `SELECT pi0.id, pairs.eng AS provider_id, pi0.item_id,
            COALESCE(q.name, pi0.name) AS name,
            pi0.base_price AS f_base, pi0.quantity AS f_qty, pi0.variant AS f_variant,
            pi0.installed AS installed, pi0.install_cost AS f_ic, pi0.install_unit AS f_iu,
            COALESCE(q.quantity, pi0.quantity)        AS r_qty,
            COALESCE(q.install_cost, pi0.install_cost) AS r_ic,
            COALESCE(q.install_unit, pi0.install_unit) AS r_iu,
            q.price_current AS q_current, q.price_override AS q_override,
            i.install_cost AS i_ic, i.install_unit AS i_iu,
            i.attributes -> 'price_tiers' AS price_tiers
       FROM (SELECT UNNEST($1::uuid[]) AS item, UNNEST($2::uuid[]) AS eng) pairs
       JOIN project_items pi0 ON pi0.id = pairs.item AND pi0.deleted_at IS NULL
       LEFT JOIN project_item_quotes q
         ON q.project_item_id = pi0.id AND q.project_provider_id = pairs.eng AND q.deleted_at IS NULL
       LEFT JOIN items i ON i.id = pi0.item_id`,
    [itemIds, engagementIds]
  );
  const map = new Map();
  for (const row of r.rows) map.set(`${row.id}|${row.provider_id}`, row);
  return map;
}

/** The InboxThreadItem (client contract). Prices = the pricing module; approval
 *  state = deriveLineState over the (provider × item) events; `line` = the SAME
 *  QuoteLine the Final Quote renders, resolved against the provider overlay. */
function toThreadItem(raw, state, line, turn, unitNeeds) {
  // The unit's size value, picked by the codelist's meta.needs (which names the
  // items column: 'serves'/'time_unit'/'size'). Never keyed off a specific code.
  const needs = unitNeeds ? unitNeeds.get(raw.unit) : null;
  const sizeRaw = needs ? raw[`i_${needs}`] : null; // i_serves / i_time_unit (size → attributes, deferred)
  const unitSize = sizeRaw == null ? null : (needs === 'serves' ? Number(sizeRaw) : sizeRaw);
  const { original, revised } = lineTotals(raw);
  return {
    id: raw.id,
    itemId: raw.item_id ?? raw.id,
    name: raw.name,
    description: raw.description || null,
    // The line's chosen variant label (resolved overlay → frozen), e.g. "Large / Red".
    variant: raw.r_variant && raw.r_variant.label ? String(raw.r_variant.label) : null,
    status: state.status,
    // Conversation TURN (Liam 2026-10-30): who sent the last message on this line
    // ('buyer' = agency, 'seller' = supplier) and whether that message is newer
    // than the last price/accept action (a message-only turn). The client deriver
    // folds these into the display code + the bold "needsYou" flag.
    lastMessageBy: turn?.lastMessageBy ?? null,
    lastEventIsMessage: turn?.lastEventIsMessage ?? false,
    // Timestamp of the last message on this line — the rail shows "last response"
    // as a WhatsApp-style day/date label (Liam 2026-10-31).
    lastMessageAt: turn?.lastMessageAt ?? null,
    // Has the supplier engaged (any message) — drives quote_requested vs to_agree
    // on a briefed line (Liam 2026-11-02).
    supplierEngaged: turn?.supplierEngaged ?? false,
    priceRef: original == null ? null : Number(original),
    priceCurrent: revised == null ? null : Number(revised),
    unitPriceRef: raw.f_base == null ? null : Number(raw.f_base),
    unitPriceCurrent: raw.q_current == null ? null : Number(raw.q_current),
    flatTotal: raw.q_override == null ? null : Number(raw.q_override),
    hasOpenQuestion: false, // buildup/question children shelved (project_buildup_shelved)
    quantity: raw.r_qty == null ? null : Number(raw.r_qty),
    unit: raw.unit ?? null,
    // SKU (catalogue ref) + the codelist-driven unit size (see above).
    sku: raw.i_ref ?? null,
    unitSize,
    installed: raw.installed ?? null,
    installCost: raw.r_ic != null ? Number(raw.r_ic) : (raw.i_ic == null ? null : Number(raw.i_ic)),
    installUnit: raw.r_iu ?? raw.i_iu ?? null,
    imageUrl: raw.image_url ?? null,
    buyerAccepted: state.buyerAccepted,
    sellerAccepted: state.sellerAccepted,
    buyerAcceptedAt: state.buyerAcceptedAt,
    sellerAcceptedAt: state.sellerAcceptedAt,
    line: line ?? null,
  };
}

/** One conversation bubble from the VIEWER's point of view. mine = the caller's
 *  org sent it. taggedItemIds = the catalogue item_ids (or custom project_items
 *  id) this message is about — the thread item filter key. */
function toBubble(m, viewer, myOrgId, counterpartyName, taggedItemIds) {
  const mine = m.from_org_id === myOrgId;
  return {
    id: m.id,
    mine,
    author: mine ? 'You' : counterpartyName || (viewer === 'supplier' ? 'Agency' : 'Supplier'),
    body: m.body || '',
    createdAt: m.created_at,
    taggedItemIds: taggedItemIds ?? [],
  };
}

/**
 * Assemble the project's threads from the VIEWER's perspective. RLS already
 * limits `messages` to the caller's pairs (an agency sees every provider; a
 * supplier sees only their own), so the same query serves both — the viewer only
 * changes display + the "mine" flag. Returns { project, threads, agencyOrgId }.
 */
async function assembleThreads(viewer, callerOrgId, projectId) {
  // The agency owns the project; derive it so we can tell the two sides apart
  // (sender === agency ⇒ buyer). Agency viewer: the caller IS the agency.
  // Accept EITHER the raw UUID or the project's human ref in the URL (EP-00021 —
  // no raw ids in URLs; resolve at the boundary, then pin the canonical id so
  // every downstream query stays id-based).
  const projRow = await pool.query(
    `SELECT id, org_id, ref, name, description, event_date, venue_name, client_name, currency, cover
       FROM projects WHERE (id::text = $1 OR ref = $1) AND deleted_at IS NULL`,
    [projectId]
  );
  if (!projRow.rows.length) throw httpErr('Project not found', 404);
  const project = projRow.rows[0];
  projectId = project.id;
  const agencyOrgId = project.org_id;
  if (viewer === 'agency' && agencyOrgId !== callerOrgId) throw httpErr('Project not found', 404);
  // Symmetric supplier guard (defense-in-depth for the EP-00021 ref path): RLS
  // already returns no row to a non-engaged supplier, but the agency path is
  // guarded at the app layer too — so require an engagement here, same 404 (no
  // oracle), so a ref/UUID can't surface another org's threads if RLS is ever off.
  if (viewer === 'supplier') {
    const eng = await pool.query(
      `SELECT 1 FROM project_providers
        WHERE project_id = $1 AND provider_org_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [projectId, callerOrgId]
    );
    if (!eng.rows.length) throw httpErr('Project not found', 404);
  }

  const msgs = await pool.query(
    `SELECT id, from_org_id, to_org_id, user_id, subject, body, created_at
       FROM messages WHERE project_id = $1 AND deleted_at IS NULL
      ORDER BY created_at ASC`,
    [projectId]
  );
  const messages = msgs.rows;
  const messageIds = messages.map((m) => m.id);

  // Relations (message → item) + each item's category + the filter key.
  const relsByMessage = new Map();  // message_id → [{ projectItemId, catId, tagKey }]
  const itemCat = new Map();        // project_item_id → catId
  if (messageIds.length) {
    const rel = await pool.query(
      `SELECT mr.message_id, mr.project_item_id, pi.project_category_id,
              pi.parent_id, COALESCE(pi.item_id, pi.id) AS tag_key
         FROM message_relations mr
         JOIN project_items pi ON pi.id = mr.project_item_id AND pi.deleted_at IS NULL
        WHERE mr.message_id = ANY($1::uuid[]) AND pi.parent_id IS NULL`,
      [messageIds]
    );
    for (const row of rel.rows) {
      const arr = relsByMessage.get(row.message_id) ?? [];
      arr.push({ projectItemId: row.project_item_id, catId: row.project_category_id, tagKey: row.tag_key });
      relsByMessage.set(row.message_id, arr);
      itemCat.set(row.project_item_id, row.project_category_id);
    }
  }

  // Latest message per line (for the conversation TURN — Liam 2026-10-30).
  // `messages` is created_at ASC, so the last write per item wins. lastFrom is
  // the sender org; lastAt lets us tell a message-only turn from an action.
  const msgByItem = new Map(); // project_item_id → { lastAt, lastFrom }
  const supplierEngaged = new Set(); // items with any message from the supplier (non-agency)
  for (const m of messages) {
    const fromSupplier = m.from_org_id !== agencyOrgId;
    for (const r of relsByMessage.get(m.id) ?? []) {
      msgByItem.set(r.projectItemId, { lastAt: m.created_at, lastFrom: m.from_org_id });
      if (fromSupplier) supplierEngaged.add(r.projectItemId);
    }
  }

  // Events, grouped by (providerOrg × project_item_id). The provider of an event
  // = the non-agency party of its message; the actor side = sender vs agency.
  const eventsByKey = new Map(); // `${providerOrg}|${itemId}` → [{status, side, createdAt, note, ...}]
  if (messageIds.length) {
    const ev = await pool.query(
      `SELECT mr.project_item_id, m.from_org_id, m.to_org_id,
              me.status, me.price_current, me.price_override, me.note, me.created_at
         FROM message_events me
         JOIN message_relations mr ON mr.id = me.message_relation_id
         JOIN messages m ON m.id = me.message_id
        WHERE me.message_id = ANY($1::uuid[])
        ORDER BY me.created_at ASC`,
      [messageIds]
    );
    for (const row of ev.rows) {
      const providerOrg = row.from_org_id === agencyOrgId ? row.to_org_id : row.from_org_id;
      const side = row.from_org_id === agencyOrgId ? 'buyer' : 'seller';
      const key = `${providerOrg}|${row.project_item_id}`;
      const arr = eventsByKey.get(key) ?? [];
      arr.push({ status: row.status, side, createdAt: row.created_at, note: row.note,
                 priceCurrent: row.price_current, priceOverride: row.price_override });
      eventsByKey.set(key, arr);
    }
  }

  // Category display (name + icon) for the project's buckets.
  const catDisplay = new Map();
  const cats = await pool.query(
    `SELECT pc.id, c.name, c.icon_name
       FROM project_categories pc LEFT JOIN categories c ON c.id = pc.category_id
      WHERE pc.project_id = $1 AND pc.deleted_at IS NULL`,
    [projectId]
  );
  for (const row of cats.rows) catDisplay.set(row.id, { name: row.name, icon: row.icon_name });

  // Group messages → providers → categories. provider = the non-agency party.
  const providerOrgIds = new Set();
  const byProvider = new Map(); // providerOrg → { messages: [], cats: Map(catId → { items:Set, messages:[] }) }
  for (const m of messages) {
    const providerOrg = m.from_org_id === agencyOrgId ? m.to_org_id : m.from_org_id;
    providerOrgIds.add(providerOrg);
    let p = byProvider.get(providerOrg);
    if (!p) { p = { messages: [], cats: new Map() }; byProvider.set(providerOrg, p); }
    p.messages.push(m);
    const rels = relsByMessage.get(m.id) ?? [];
    const catIds = [...new Set(rels.map((r) => r.catId))];
    // A message with no item relations (a general note) still belongs to the
    // provider; bucket it under each category it touches (none → skip in threads).
    for (const catId of catIds) {
      let c = p.cats.get(catId);
      if (!c) { c = { items: new Set(), messages: [] }; p.cats.set(catId, c); }
      c.messages.push(m);
      for (const r of rels) if (r.catId === catId) c.items.add(r.projectItemId);
    }
  }

  // Provider engagement ids (for the per-provider overlay resolution) + display.
  const engRows = await pool.query(
    `SELECT id, provider_org_id FROM project_providers
      WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  const providerIdByOrg = new Map();
  for (const row of engRows.rows) providerIdByOrg.set(row.provider_org_id, row.id);

  const supplierDisplay = await fetchOrgDisplay('agency', [...providerOrgIds]); // suppliers
  const agencyDisplay = viewer === 'supplier' ? await fetchOrgDisplay('supplier', [agencyOrgId]) : null;
  const agencyCard = agencyDisplay ? agencyDisplay.get(agencyOrgId) : null;

  const threads = [];
  for (const [providerOrg, p] of byProvider.entries()) {
    const providerId = providerIdByOrg.get(providerOrg) ?? null;
    const sd = supplierDisplay.get(providerOrg) || {};
    // Resolve every item this provider is briefed on (one batched query).
    const allItemIds = [];
    for (const c of p.cats.values()) for (const id of c.items) allItemIds.push(id);
    const resolved = providerId ? await resolvedLines(allItemIds, providerId) : new Map();
    // Batch EVERY line for this provider in one round-trip (was a per-item query
    // in the loop below → an N+1 across projects × items that made the inbox very
    // slow to paint — Liam 2026-11-19).
    const lineMap = providerId ? await projectLine.linesByIdsForProvider(pool, allItemIds, providerId) : new Map();
    const unitNeeds = await unitNeedsMap(); // code → meta.needs, memoised per request

    for (const [catId, c] of p.cats.entries()) {
      if (!c.items.size) continue;
      const lead = c.messages[0]; // earliest (messages are created_at ASC)
      if (!lead) continue;
      const cat = catDisplay.get(catId) || {};
      const items = [];
      for (const itemId of c.items) {
        const raw = resolved.get(itemId);
        if (!raw) continue;
        const evs = eventsByKey.get(`${providerOrg}|${itemId}`) ?? [];
        const state = mev.deriveLineState(evs, { briefed: true });
        const line = lineMap.get(itemId) ?? null;
        // Conversation turn: who sent the last message on this line, and whether
        // it post-dates the last action (a message-only turn). evs are ASC.
        const lastAction = evs.length ? evs[evs.length - 1].createdAt : null;
        const mi = msgByItem.get(itemId);
        const turn = {
          lastMessageBy: mi ? (mi.lastFrom === agencyOrgId ? 'buyer' : 'seller') : null,
          // The reply_needed/replied CODES apply only once pricing has started — a
          // message strictly newer than an EXISTING action. The initial brief (no
          // action yet) keeps the deal code; bold/needsYou still shows the turn
          // (Liam 2026-11-02 — a brief was reading as "Replied").
          lastEventIsMessage: !!(mi && lastAction && new Date(mi.lastAt) > new Date(lastAction)),
          lastMessageAt: mi ? mi.lastAt : null,
          supplierEngaged: supplierEngaged.has(itemId),
        };
        items.push(toThreadItem(raw, state, line, turn, unitNeeds));
      }
      if (!items.length) continue;

      const counterpartyName = viewer === 'agency' ? (sd.name ?? null) : (agencyCard?.name ?? null);
      const originalTotal = items.reduce((s, it) => s + (isDeclined(it.status) ? 0 : (it.priceRef ?? 0)), 0);
      const revisedTotal = items.reduce((s, it) => s + (isDeclined(it.status) ? 0 : (it.priceCurrent ?? it.priceRef ?? 0)), 0);
      threads.push({
        id: lead.id,
        categoryId: catId ?? null,
        categoryName: cat.name ?? null,
        categoryIconName: cat.icon ?? null,
        agencyOrgId,
        agencyName: agencyCard?.name ?? null,
        agencyLogoUrl: agencyCard?.logoUrl ?? null,
        supplierOrgId: providerOrg,
        supplierName: sd.name ?? null,
        supplierLogoUrl: sd.logoUrl ?? null,
        projectId,
        projectName: project.name ?? null,
        refCode: null,
        status: '', // thread-level aggregate not needed by the ported UI (per-item pills drive it)
        total: revisedTotal,
        originalTotal,
        revisedTotal,
        items,
        messages: p.cats.get(catId).messages
          .filter((m) => (m.body || '').trim())
          .map((m) => toBubble(m, viewer, callerOrgId, counterpartyName,
            (relsByMessage.get(m.id) ?? []).map((r) => r.tagKey))),
      });
    }
  }

  // Newest-active thread first.
  threads.sort((a, b) => {
    const am = a.messages[a.messages.length - 1]?.createdAt ?? 0;
    const bm = b.messages[b.messages.length - 1]?.createdAt ?? 0;
    return new Date(bm) - new Date(am);
  });

  const allItems = threads.flatMap((t) => t.items);
  const summary = {
    id: projectId,
    ref: project.ref ?? null,
    name: project.name ?? null,
    description: project.description ?? null,
    coverUrl: (project.cover || {}).imageUrl ?? null,
    coverFocalX: (project.cover || {}).focalX ?? 50,
    coverFocalY: (project.cover || {}).focalY ?? 50,
    clientName: project.client_name ?? null,
    eventDate: project.event_date ?? null,
    location: project.venue_name ?? null,
    agencyName: viewer === 'supplier' ? (agencyCard?.name ?? null) : null,
    agencyLogoUrl: viewer === 'supplier' ? (agencyCard?.logoUrl ?? null) : null,
    itemCount: allItems.length,
    currency: project.currency ?? 'GBP',
    originalTotal: allItems.reduce((s, it) => s + (isDeclined(it.status) ? 0 : (it.priceRef ?? 0)), 0),
    revisedTotal: allItems.reduce((s, it) => s + (isDeclined(it.status) ? 0 : (it.priceCurrent ?? it.priceRef ?? 0)), 0),
  };

  return { project: summary, threads, agencyOrgId };
}

// ── reads (route-facing) ─────────────────────────────────────────────────────

/** pV2-INBOX-03 — the agent inbox for one project: every supplier thread
 *  (per supplier × category), agency perspective. org from JWT. */
async function getAgentThreads(agencyOrgId, projectId) {
  const { project, threads } = await assembleThreads('agency', agencyOrgId, projectId);
  return { project, threads };
}

/** pV2-INBOX-01 — the caller-supplier's inbox for one project: their own
 *  threads (per category) + the project summary. org from JWT (RLS scopes the
 *  messages to their pair). Requires the engaged-provider read widenings (0023). */
async function getSupplierThreads(supplierOrgId, projectId) {
  const { project, threads } = await assembleThreads('supplier', supplierOrgId, projectId);
  return { project, threads };
}

/** Map an engaged project (supplier view) to the ProjectCard contract — the
 *  reaching-out agency lands on the cover chip; the headline = the supplier's
 *  running quote value (their overlay revised totals). */
function toSupplierProjectCard(row, agencyCard, quoteTotal) {
  const cover = row.cover || {};
  return {
    // The card links to /inbox/:projectId (the project's conversation), and the
    // listSupplierProjects query exposes the project id as project_id (pp.id is
    // aliased to provider_id) — so the ProjectCard id is the PROJECT id, not a
    // non-existent row.id (which produced /inbox/undefined).
    id: row.project_id,
    name: row.name,
    ref: row.ref,
    status: row.status ?? 'active',
    coverUrl: cover.imageUrl ?? null,
    coverFocalX: cover.focalX ?? 50,
    coverFocalY: cover.focalY ?? 50,
    iconName: row.icon_name ?? null,
    iconColor: row.icon_color ?? null,
    unsplashPhotographerName: cover.unsplashPhotographerName ?? null,
    unsplashPhotoUrl: cover.unsplashPhotoUrl ?? null,
    clientName: agencyCard?.name ?? null,      // who's asking = the agency
    clientLogoUrl: agencyCard?.logoUrl ?? null,
    ballparkCost: quoteTotal == null ? null : Number(quoteTotal),
    currency: row.currency ?? 'GBP',
    supplierCount: 0, // NOTE: the agency card labels this "{n} suppliers"; the
                      // supplier card wants its own label (Defer 1, as in UNIFY-01).
    updatedAt: row.updated_at ?? row.created_at,
  };
}

/** pV2-INBOX-01 — every project the caller-supplier has been engaged on, newest
 *  first, shaped as ProjectCard[] for /projects?bucket=quoting. The running
 *  quote value = the SUM of their revised line totals across the project.
 *  org from JWT. Requires the engaged-provider read widenings (0023). */
async function listSupplierProjects(supplierOrgId) {
  const engs = await pool.query(
    `SELECT pp.id AS provider_id, pp.project_id, p.org_id AS agency_org_id,
            p.ref, p.name, p.status, p.currency, p.cover, p.icon_name, p.icon_color,
            p.created_at, pp.updated_at
       FROM project_providers pp
       JOIN projects p ON p.id = pp.project_id AND p.deleted_at IS NULL
      WHERE pp.provider_org_id = $1 AND pp.deleted_at IS NULL
      ORDER BY pp.updated_at DESC NULLS LAST`,
    [supplierOrgId]
  );
  if (!engs.rows.length) return [];
  const agencyDisplay = await fetchOrgDisplay('supplier', engs.rows.map((r) => r.agency_org_id));
  const out = [];
  for (const row of engs.rows) {
    // Briefed items for this engagement = the project_items referenced by a
    // message relation on the (agency ↔ this supplier) pair.
    const itemsRes = await pool.query(
      `SELECT DISTINCT mr.project_item_id
         FROM message_relations mr
         JOIN messages m ON m.id = mr.message_id AND m.deleted_at IS NULL
        WHERE m.project_id = $1
          AND $2 IN (m.from_org_id, m.to_org_id)
          AND mr.project_item_id IS NOT NULL`,
      [row.project_id, supplierOrgId]
    );
    const ids = itemsRes.rows.map((r) => r.project_item_id);
    const resolved = await resolvedLines(ids, row.provider_id);
    let total = 0;
    for (const raw of resolved.values()) {
      const { revised } = lineTotals(raw);
      total += Number(revised || 0);
    }
    out.push(toSupplierProjectCard(row, agencyDisplay.get(row.agency_org_id), ids.length ? total : null));
  }
  return out;
}

/** Whose move is one line from the AGENT's perspective: 'agent' | 'supplier' |
 *  null (settled). Mirrors the client inbox-status itemAction for the agency. */
function itemWaitingOn(it) {
  if (it.status === 'booked' || isDeclined(it.status)) return null;
  // Ball follows the last message — a message newer than the last price/accept
  // action reopens the line to the RECIPIENT, even after both sides accepted
  // (Liam 2026-11-19: a post-acceptance question is an action, not "settled").
  // Mirrors the client lineDisplayCode / needsYou reorder.
  if (it.lastEventIsMessage && it.lastMessageBy) {
    return it.lastMessageBy === 'buyer' ? 'supplier' : 'agent';
  }
  if (it.buyerAccepted && it.sellerAccepted) return null;
  if (it.sellerAccepted && !it.buyerAccepted) return 'agent';
  if (it.status === 'adjusted_by_supplier') return 'agent';
  if (it.status === 'brief_sent' || it.status === 'adjusted_by_agent') return 'supplier';
  return 'supplier';
}

function truncate(s, max) {
  if (!s) return null;
  return s.length > max ? s.slice(0, max - 1).trimEnd() + '…' : s;
}

/** pV2-INBOX (Messages landing) — one rollup row per ACTIVE agency project the
 *  agency has messaged: project name/client, the suppliers on it, and how many
 *  line items are waiting on the agent vs the supplier. org from JWT. */
async function getAgentInboxSummary(agencyOrgId) {
  // SET-BASED (Liam 2026-11-19): the old path assembled every project's full thread
  // (messages, categories, org display, per-item pricing) just to roll up counts +
  // totals — ~140 queries serialised on ONE pinned connection ≈ 8s. This fetches the
  // whole agency's active-project data in ~7 batched queries and rolls up in JS,
  // reusing deriveLineState / itemWaitingOn / lineTotals so counts + £ totals are
  // identical to the per-thread path.
  const projs = await pool.query(
    `SELECT p.id, p.ref, p.name, p.client_name FROM projects p
      WHERE p.org_id = $1 AND p.deleted_at IS NULL
        AND COALESCE(p.status, 'draft') NOT IN ('completed', 'archived')
        AND EXISTS (SELECT 1 FROM project_providers pp
                     WHERE pp.project_id = p.id AND pp.deleted_at IS NULL)
      ORDER BY p.updated_at DESC`,
    [agencyOrgId]
  );
  if (!projs.rows.length) return [];
  const projectIds = projs.rows.map((r) => r.id);

  const [relR, evR, sowR, engR] = await Promise.all([
    pool.query(
      `SELECT mr.project_item_id, m.project_id, m.from_org_id, m.to_org_id, m.body, m.created_at
         FROM message_relations mr
         JOIN messages m ON m.id = mr.message_id AND m.deleted_at IS NULL
         JOIN project_items pi ON pi.id = mr.project_item_id AND pi.deleted_at IS NULL AND pi.parent_id IS NULL
        WHERE m.project_id = ANY($1::uuid[])
        ORDER BY m.created_at ASC`, [projectIds]),
    pool.query(
      `SELECT mr.project_item_id, m.project_id, m.from_org_id, m.to_org_id,
              me.status, me.price_current, me.price_override, me.note, me.created_at
         FROM message_events me
         JOIN message_relations mr ON mr.id = me.message_relation_id
         JOIN messages m ON m.id = me.message_id
        WHERE m.project_id = ANY($1::uuid[])
        ORDER BY me.created_at ASC`, [projectIds]),
    pool.query(
      `SELECT project_id, org_id AS supplier_org, status FROM project_documents
        WHERE project_id = ANY($1::uuid[]) AND type = 'sow' AND deleted_at IS NULL`, [projectIds]),
    pool.query(
      `SELECT id, project_id, provider_org_id FROM project_providers
        WHERE project_id = ANY($1::uuid[]) AND deleted_at IS NULL`, [projectIds]),
  ]);

  const providerOf = (from, to) => (from === agencyOrgId ? to : from);
  // engagement id per (project, provider) — the overlay key; a provider with no
  // engagement is skipped (matches the old path, where no overlay ⇒ no thread).
  const engBy = new Map();
  for (const r of engR.rows) engBy.set(`${r.project_id}|${r.provider_org_id}`, r.id);

  // events keyed `${project}|${provider}|${item}`
  const eventsByKey = new Map();
  for (const r of evR.rows) {
    const key = `${r.project_id}|${providerOf(r.from_org_id, r.to_org_id)}|${r.project_item_id}`;
    let arr = eventsByKey.get(key); if (!arr) { arr = []; eventsByKey.set(key, arr); }
    arr.push({ status: r.status, side: r.from_org_id === agencyOrgId ? 'buyer' : 'seller',
               createdAt: r.created_at, note: r.note, priceCurrent: r.price_current, priceOverride: r.price_override });
  }

  // briefed items per (project, provider); per-item last-message turn; last msg per supplier
  const sups = new Map(); // `${project}|${provider}` → { project, provider, items:Set, lastMsg:{body,at} }
  const lastMsgItem = new Map(); // `${sk}|${item}` → { from, at }
  for (const r of relR.rows) {
    const provider = providerOf(r.from_org_id, r.to_org_id);
    const sk = `${r.project_id}|${provider}`;
    let g = sups.get(sk); if (!g) { g = { project: r.project_id, provider, items: new Set(), lastMsg: null }; sups.set(sk, g); }
    g.items.add(r.project_item_id);
    g.lastMsg = { body: r.body, at: r.created_at }; // ASC → last wins
    lastMsgItem.set(`${sk}|${r.project_item_id}`, { from: r.from_org_id, at: r.created_at });
  }

  // one batched pricing query across every briefed (item, engagement) pair
  const itemIds = [], engIds = [];
  for (const [sk, g] of sups) {
    const eng = engBy.get(sk);
    if (!eng) continue;
    for (const item of g.items) { itemIds.push(item); engIds.push(eng); }
  }
  const priceMap = await resolvedLinesForPairs(itemIds, engIds); // `${item}|${eng}` → raw

  const sowBy = new Map();
  for (const r of sowR.rows) sowBy.set(`${r.project_id}|${r.supplier_org}`, r.status);
  const providerOrgs = [...new Set([...sups.values()].map((g) => g.provider))];
  const supplierDisplay = await fetchOrgDisplay('agency', providerOrgs);

  // roll up, in project order
  const projById = new Map();
  for (const [sk, g] of sups) {
    const eng = engBy.get(sk);
    if (!eng) continue; // no overlay ⇒ the old path produced no thread for this supplier
    const seenNames = [];
    let wa = 0, ws = 0, n = 0, cw = 0, actionItemId = null, lineNames = [];
    for (const itemId of g.items) {
      const raw = priceMap.get(`${itemId}|${eng}`);
      if (!raw) continue; // project_item gone
      const evs = eventsByKey.get(`${g.project}|${g.provider}|${itemId}`) || [];
      const state = mev.deriveLineState(evs, { briefed: true });
      if (isDeclined(state.status)) continue;
      n++;
      lineNames.push(raw.name);
      const lastAction = evs.length ? evs[evs.length - 1].createdAt : null;
      const lm = lastMsgItem.get(`${sk}|${itemId}`);
      const it = {
        status: state.status, buyerAccepted: state.buyerAccepted, sellerAccepted: state.sellerAccepted,
        lastMessageBy: lm ? (lm.from === agencyOrgId ? 'buyer' : 'seller') : null,
        lastEventIsMessage: !!(lm && lastAction && new Date(lm.at) > new Date(lastAction)),
      };
      const w = itemWaitingOn(it);
      if (w === 'agent') { wa++; if (!actionItemId) actionItemId = itemId; }
      else if (w === 'supplier') ws++;
      if (state.status === 'booked' || (state.buyerAccepted && state.sellerAccepted)) {
        const { original, revised } = lineTotals(raw);
        cw += Number(revised ?? original ?? 0);
      }
    }
    const sowStatus = sowBy.get(sk) ?? null;
    const sowNeedsAgent = sowStatus === 'in_review';
    const supplier = {
      orgId: g.provider, name: supplierDisplay.get(g.provider)?.name ?? null,
      itemCount: n, waitingAgent: wa, waitingSupplier: ws,
      actionRequired: wa > 0 || sowNeedsAgent, actionItemId,
      sowStatus,
      confirmedWork: Math.round(cw), itemNames: lineNames,
      lastMessage: truncate(g.lastMsg?.body ?? null, 240), lastMessageAt: g.lastMsg?.at ?? null,
    };
    let proj = projById.get(g.project);
    if (!proj) { proj = { suppliers: [], names: new Map(), wa: 0, ws: 0, n: 0, cw: 0, sowAction: false }; projById.set(g.project, proj); }
    proj.suppliers.push(supplier);
    proj.wa += wa; proj.ws += ws; proj.n += n; proj.cw += cw;
    if (sowNeedsAgent) proj.sowAction = true;
    for (const nm of lineNames) if (!proj.names.has(nm)) proj.names.set(nm, true);
  }

  const out = [];
  for (const p of projs.rows) {
    const agg = projById.get(p.id);
    if (!agg) continue; // no visible suppliers ⇒ dropped (old path's empty-thread filter)
    out.push({
      id: p.id, ref: p.ref ?? null, name: p.name, clientName: p.client_name ?? null,
      suppliers: agg.suppliers, itemNames: [...agg.names.keys()],
      itemCount: agg.n, waitingAgent: agg.wa, waitingSupplier: agg.ws,
      actionRequired: agg.wa > 0 || agg.sowAction,
      confirmedWork: Math.round(agg.cw),
    });
  }
  return out;
}

/** Live-project overview metrics (agency): value of both-sides-agreed items,
 *  agreed vs total item counts, and how many supplier threads still have an
 *  open item. Cancelled/declined lines excluded. org from JWT. */
async function getProjectOverview(agencyOrgId, projectId) {
  const { threads } = await assembleThreads('agency', agencyOrgId, projectId);
  let agreedItems = 0, totalItems = 0, openThreads = 0, actionItems = 0;
  const seen = new Set();
  for (const t of threads) {
    let threadOpen = false;
    for (const it of t.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      if (isDeclined(it.status)) continue;
      totalItems++;
      const agreed = it.status === 'booked' || (it.buyerAccepted && it.sellerAccepted);
      if (agreed) agreedItems++;
      else {
        threadOpen = true;
        // "Unactioned" = it's the agent's turn to act (the Inbox tab badge).
        if (itemWaitingOn(it) === 'agent') actionItems++;
      }
    }
    if (threadOpen) openThreads++;
  }
  return { agreedItems, totalItems, openThreads, actionItems };
}

// ── writes (route-facing) ────────────────────────────────────────────────────

/** Ensure a project_providers engagement (revive a soft-deleted row on
 *  re-engagement — UNIQUE(project, provider)). Runs on a txn client. org_id =
 *  the agency (sacred). Returns the engagement id. */
async function ensureProvider(client, { agencyOrgId, projectId, providerOrgId }) {
  const existing = await client.query(
    `SELECT id, deleted_at FROM project_providers
      WHERE project_id = $1 AND provider_org_id = $2 FOR UPDATE`,
    [projectId, providerOrgId]
  );
  const live = existing.rows.find((r) => r.deleted_at === null);
  if (live) return live.id;
  const dead = existing.rows.find((r) => r.deleted_at !== null);
  if (dead) {
    await client.query(
      `UPDATE project_providers
          SET deleted_at = NULL, deleted_by = NULL, status = 'pending', updated_at = NOW()
        WHERE id = $1`,
      [dead.id]
    );
    return dead.id;
  }
  const ins = await client.query(
    `INSERT INTO project_providers (org_id, project_id, provider_org_id, status)
     VALUES ($1, $2, $3, 'pending') RETURNING id`,
    [agencyOrgId, projectId, providerOrgId]
  );
  return ins.rows[0].id;
}

/** pV2-INBOX-02 — fan a project's quote out to the picked suppliers. For each
 *  (category bucket → supplierIds) in the roster: ensure the engagement spine,
 *  then a brief message (agency → supplier) + a message_relations row per
 *  not-yet-briefed item in that category. No events (baseline = brief_sent) and
 *  no overlay rows yet (pending until a side quotes). First successful send
 *  flips the project Draft → Active. Atomic (Rule 1). org from JWT. */
async function sendOutreach({ agencyOrgId, userId, projectId, roster }) {
  const proj = await pool.query(
    `SELECT org_id, status FROM projects WHERE id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  if (!proj.rows.length) throw httpErr('Project not found', 404);
  if (proj.rows[0].org_id !== agencyOrgId) throw httpErr('Project not found', 404);
  const wasDraft = (proj.rows[0].status ?? 'draft') === 'draft';

  // pV2-INVITE-SUPPLIER-01 — defence in depth behind the disabled UI: an
  // invited supplier that hasn't joined (orgs.status 'pending') can't be briefed
  // (no one to read it; a project_providers row would also grant it project
  // READ). The gated definer only answers for suppliers THIS agency invited.
  const allSupplierIds = [...new Set(roster.flatMap((e) => e.supplierIds || []).filter(Boolean))];
  if (allSupplierIds.length) {
    const pending = await pool.query(
      `SELECT c.name FROM unnest($1::uuid[]) AS s(id)
         CROSS JOIN LATERAL public.invited_supplier_contact(s.id) c
        WHERE c.status = 'pending'`,
      [allSupplierIds]
    );
    if (pending.rows.length) {
      throw httpErr(`${pending.rows[0].name} hasn't joined yet`, 400);
    }
  }

  const results = [];
  let threadCount = 0;
  await withTransaction(async (client) => {
    // Event context for the brief body — date / guests / venue, fetched once so the
    // supplier knows what they're quoting for (Liam 2026-11-18). No city column yet.
    const projRow = await client.query(
      `SELECT event_date, guest_count, venue_name FROM projects WHERE id = $1`,
      [projectId]
    );
    const pj = projRow.rows[0] || {};
    const eventCtx = [
      pj.event_date && `Event date: ${pj.event_date}`,
      (pj.guest_count != null) && `${pj.guest_count} guests`,
      pj.venue_name && `Venue: ${pj.venue_name}`,
    ].filter(Boolean).join(' · ');
    for (const entry of roster) {
      const categoryId = entry.categoryId; // a project_categories bucket id
      const supplierIds = [...new Set((entry.supplierIds || []).filter(Boolean))];
      if (!supplierIds.length) continue;

      // The bucket's category name → the brief subject.
      const catRow = await client.query(
        `SELECT c.name FROM project_categories pc LEFT JOIN categories c ON c.id = pc.category_id
          WHERE pc.id = $1 AND pc.project_id = $2 AND pc.deleted_at IS NULL`,
        [categoryId, projectId]
      );
      const catName = catRow.rows[0]?.name ?? 'your project';
      let suppliersBriefed = 0;

      for (const supplierId of supplierIds) {
        // Items in the bucket NOT yet briefed to THIS supplier (idempotent
        // re-send: a later add is briefed; already-sent items are not re-sent).
        const items = await client.query(
          // pV2-ADD-LINE-SUPPLIER-01: ONLY this supplier's lines — the catalogue
          // owner, or (custom) the supplier asked to cost it (0033). Previously the
          // whole category bucket went to every picked supplier, so messaging B
          // also briefed A's lines. A supplier-less line (NULL) never matches →
          // never swept into a send (one supplier per line for now).
          `SELECT pi.id FROM project_items pi
             LEFT JOIN items i ON i.id = pi.item_id
            WHERE pi.project_id = $1 AND pi.project_category_id = $2
              AND pi.parent_id IS NULL AND pi.deleted_at IS NULL
              AND COALESCE(i.org_id, pi.requested_provider_org_id) = $4
              AND NOT EXISTS (
                SELECT 1 FROM message_relations mr
                  JOIN messages m ON m.id = mr.message_id AND m.deleted_at IS NULL
                 WHERE mr.project_item_id = pi.id
                   AND m.from_org_id = $3 AND m.to_org_id = $4)`,
          [projectId, categoryId, agencyOrgId, supplierId]
        );
        if (!items.rows.length) continue;

        await ensureProvider(client, { agencyOrgId, projectId, providerOrgId: supplierId });
        const msg = await client.query(
          `INSERT INTO messages
             (from_org_id, to_org_id, user_id, project_id, subject, body, status, next_action_by)
           VALUES ($1, $2, $3, $4, $5, $6, 'sent', $2) RETURNING id`,
          [agencyOrgId, supplierId, userId || null, projectId,
           `Quote request: ${catName}`, `We'd like your quote for ${catName}.` + (eventCtx ? `\n${eventCtx}` : '')]
        );
        const messageId = msg.rows[0].id;
        for (const it of items.rows) {
          await client.query(
            `INSERT INTO message_relations (message_id, project_item_id) VALUES ($1, $2)`,
            [messageId, it.id]
          );
        }
        suppliersBriefed++;
        threadCount++;
      }
      if (suppliersBriefed) results.push({ categoryId, suppliers: suppliersBriefed });
    }

    // First outreach takes the project Draft → Active (unlocks Inbox/Reports).
    if (wasDraft && threadCount) {
      await client.query(
        `UPDATE projects SET status = 'active', updated_at = NOW()
          WHERE id = $1 AND org_id = $2 AND COALESCE(status, 'draft') = 'draft'`,
        [projectId, agencyOrgId]
      );
    }
  });

  return { categories: results.length, threads: threadCount, results };
}

/** pV2-STORE-ADD-ACTIVE-01 — context for the "add an item to an ACTIVE project"
 *  dialog: the item's OWNER supplier (and whether it's already on the project),
 *  plus the project's OTHER existing suppliers ("ask to quote"). Agency-only; the
 *  caller must own the project. Cross-org supplier names via supplier_directory. */
async function getActiveAddContext(agencyOrgId, projectId, itemId) {
  const proj = await pool.query(
    `SELECT id, name FROM projects WHERE id = $1 AND org_id = $2 AND deleted_at IS NULL`,
    [projectId, agencyOrgId]
  );
  if (!proj.rows.length) throw httpErr('Project not found', 404);

  const itemRes = await pool.query(
    `SELECT name, org_id AS owner_org_id, base_price, unit
       FROM items WHERE id = $1 AND deleted_at IS NULL`,
    [itemId]
  );
  if (!itemRes.rows.length) throw httpErr('Item not found', 404);
  const ownerOrgId = itemRes.rows[0].owner_org_id;

  const provRes = await pool.query(
    `SELECT provider_org_id FROM project_providers
      WHERE project_id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  const providerIds = provRes.rows.map((r) => r.provider_org_id);
  const onProject = new Set(providerIds);

  const display = await fetchOrgDisplay('agency', [ownerOrgId, ...providerIds]);
  const nameOf = (id) => display.get(id)?.name ?? 'Supplier';

  return {
    projectName: proj.rows[0].name ?? null,
    itemName: itemRes.rows[0].name,
    indicativePrice: itemRes.rows[0].base_price == null ? null : Number(itemRes.rows[0].base_price),
    unit: itemRes.rows[0].unit ?? null,
    owner: { orgId: ownerOrgId, name: nameOf(ownerOrgId), onProject: onProject.has(ownerOrgId) },
    others: providerIds.filter((id) => id !== ownerOrgId).map((id) => ({ orgId: id, name: nameOf(id) })),
  };
}

/** pV2-STORE-ADD-ACTIVE-01 — add a catalogue item to an ACTIVE project as a
 *  ballpark, routed to ONE supplier: create the line, stamp the settlement intent
 *  (balance | deposit_50 — no payments yet), ensure the engagement + post the
 *  editable brief tagged to the line (opens/joins that supplier's thread).
 *  Agency-only; the caller must own the project. */
async function addItemToActiveProject({ agencyOrgId, userId, projectId, itemId, supplierOrgId, settlement, message }) {
  const line = await projectLine.addItem(agencyOrgId, projectId, itemId);
  if (!line) throw httpErr('Could not add item', 404);

  await withTransaction(async (db) => {
    await db.query(
      `UPDATE project_items
          SET attributes = COALESCE(attributes, '{}'::jsonb) || jsonb_build_object('settlement', $2::text),
              updated_at = NOW()
        WHERE id = $1`,
      [line.id, settlement === 'deposit_50' ? 'deposit_50' : 'balance']
    );
    await ensureProvider(db, { agencyOrgId, projectId, providerOrgId: supplierOrgId });
    const msg = await db.query(
      `INSERT INTO messages (from_org_id, to_org_id, user_id, project_id, subject, body, status, next_action_by)
       VALUES ($1, $2, $3, $4, $5, $6, 'sent', $2) RETURNING id`,
      [agencyOrgId, supplierOrgId, userId || null, projectId, 'Quote request',
       (message && String(message).trim()) || `We'd like your quote for ${line.name}.`]
    );
    await db.query(
      `INSERT INTO message_relations (message_id, project_item_id) VALUES ($1, $2)`,
      [msg.rows[0].id, line.id]
    );
  });

  return { ok: true, lineId: line.id };
}

/** The resulting status + the event/overlay field payload for one action. */
function actionPayload(action, side, { price, installCost, flatTotal, note }) {
  const status = mev.statusFor(action, side);
  if (action === 'accept') {
    return { status, event: {}, overlay: { status } };
  }
  if (action === 'decline') {
    return { status, event: { note }, overlay: { status, declineReason: note ?? null } };
  }
  // adjust — per-unit XOR flat; install cost rides in `changes` + the overlay.
  const priceCurrent = flatTotal != null ? null : (price != null ? price : null);
  const priceOverride = flatTotal != null ? flatTotal : null;
  const changes = {};
  if (installCost != null) changes.install_cost = installCost;
  return {
    status,
    event: { priceCurrent, priceOverride, changes: Object.keys(changes).length ? changes : null, note },
    overlay: {
      status,
      priceCurrent, priceOverride,
      installCost: installCost != null ? installCost : undefined,
    },
  };
}

/** pV2-INBOX-01/03 — reply in a thread: a chat message and/or per-item actions
 *  (Accept / Suggest-new-price / Decline). Every state change writes BOTH a
 *  message_event (append-only journal) AND the provider overlay (current form) —
 *  the single-write-path invariant. A bodyless reply is an action, not a bubble.
 *  Authority: the caller must be a party (agency = project owner; supplier =
 *  engaged provider). One transaction (Rule 1). org from JWT. */
async function reply({ viewer, orgId, userId, threadId, text, itemActions, taggedItemId }) {
  const isSupplier = viewer !== 'agency';
  const anchor = await pool.query(
    `SELECT m.id, m.project_id, m.from_org_id, m.to_org_id, p.org_id AS agency_org_id
       FROM messages m JOIN projects p ON p.id = m.project_id
      WHERE m.id = $1 AND m.deleted_at IS NULL`,
    [threadId]
  );
  if (!anchor.rows.length) throw httpErr('Thread not found', 404);
  const a = anchor.rows[0];
  const agencyOrgId = a.agency_org_id;
  const providerOrg = a.from_org_id === agencyOrgId ? a.to_org_id : a.from_org_id;

  // Participation (same 404 for not-found / not-yours — no disclosure).
  if (isSupplier) {
    if (orgId !== providerOrg) throw httpErr('Thread not found', 404);
  } else if (orgId !== agencyOrgId) {
    throw httpErr('Thread not found', 404);
  }
  const counterparty = isSupplier ? agencyOrgId : providerOrg;

  const actions = Array.isArray(itemActions) ? itemActions : [];
  const hasText = !!(text && String(text).trim());
  if (!hasText && !actions.length) throw httpErr('reply needs text or item actions', 400);

  const side = isSupplier ? 'seller' : 'buyer';

  return withTransaction(async (db) => {
    // The engagement spine for the provider (overlay writes key on it). The
    // agency briefed it on send; a supplier replying always has one.
    const eng = await db.query(
      `SELECT id FROM project_providers
        WHERE project_id = $1 AND provider_org_id = $2 AND deleted_at IS NULL`,
      [a.project_id, providerOrg]
    );
    const providerId = eng.rows[0]?.id ?? null;

    // One reply message carries the whole action set (body NULL ⇒ an action).
    const ins = await db.query(
      `INSERT INTO messages
         (from_org_id, to_org_id, user_id, project_id, subject, body, status, next_action_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $2) RETURNING id`,
      [orgId, counterparty, userId || null, a.project_id,
       `Re: project`, hasText ? text : null, isSupplier ? 'unread' : 'sent']
    );
    const replyId = ins.rows[0].id;

    const changes = [];
    const tagged = new Set();
    for (const act of actions) {
      const { itemId, action } = act || {};
      if (!itemId || !mev.ACTIONS.has(action)) continue;
      // The item must belong to this project (RLS already scopes it to the pair).
      const chk = await db.query(
        `SELECT name FROM project_items
          WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        [itemId, a.project_id]
      );
      if (!chk.rows.length) {
        console.warn(`[inbox] reply action skipped: item ${itemId} not in project ${a.project_id}`);
        continue;
      }
      const { status, event, overlay } = actionPayload(action, side, act);
      const rel = await db.query(
        `INSERT INTO message_relations (message_id, project_item_id) VALUES ($1, $2) RETURNING id`,
        [replyId, itemId]
      );
      await mev.writeEvent(db, {
        messageId: replyId, relationId: rel.rows[0].id, status,
        priceCurrent: event.priceCurrent ?? null, priceOverride: event.priceOverride ?? null,
        changes: event.changes ?? null, note: event.note ?? null, userId,
      });
      if (providerId) {
        await mev.upsertOverlay(db, { projectItemId: itemId, providerId, orgId: agencyOrgId, fields: overlay });
      }
      tagged.add(itemId);
      changes.push({ name: chk.rows[0].name, from: '', to: status });
    }

    // A bodied message composed with an item selected tags that line too (so the
    // bubble shows in the item filter) — resolve the filter key to a line.
    if (taggedItemId && !tagged.has(taggedItemId)) {
      const nm = await db.query(
        `SELECT id FROM project_items
          WHERE project_id = $1 AND (item_id = $2 OR id = $2)
            AND parent_id IS NULL AND deleted_at IS NULL LIMIT 1`,
        [a.project_id, taggedItemId]
      );
      if (nm.rows.length && !tagged.has(nm.rows[0].id)) {
        await db.query(
          `INSERT INTO message_relations (message_id, project_item_id) VALUES ($1, $2)`,
          [replyId, nm.rows[0].id]
        );
      }
    }

    return { ok: true, replyId, changes };
  });
}

/** pV2-INTENT-02 — the recent conversation on ONE line, for the Assistant's
 *  prompt. ORG-SCOPED: the caller must be the line's engaged provider OR the
 *  project's owning agency, else null. Oldest-first. */
async function getLineConversation(orgId, projectId, lineId, { limit = 14 } = {}) {
  const access = await pool.query(
    `SELECT 1 FROM project_items pi
      WHERE pi.id = $1 AND pi.project_id = $2 AND pi.deleted_at IS NULL
        AND (EXISTS (SELECT 1 FROM projects p WHERE p.id = $2 AND p.org_id = $3 AND p.deleted_at IS NULL)
             OR EXISTS (SELECT 1 FROM project_providers pp
                         WHERE pp.project_id = $2 AND pp.provider_org_id = $3 AND pp.deleted_at IS NULL))
      LIMIT 1`,
    [lineId, projectId, orgId]
  );
  if (!access.rows.length) return null;
  const r = await pool.query(
    `SELECT m.body, m.from_org_id, m.created_at, p.org_id AS agency_org_id
       FROM messages m
       JOIN message_relations mr ON mr.message_id = m.id
       JOIN projects p ON p.id = m.project_id
      WHERE mr.project_item_id = $1 AND m.deleted_at IS NULL AND COALESCE(m.body, '') <> ''
      ORDER BY m.created_at DESC LIMIT $2`,
    [lineId, limit]
  );
  return r.rows.reverse().map((m) => ({
    who: m.from_org_id === m.agency_org_id ? 'Agent' : 'Supplier',
    text: String(m.body).slice(0, 400),
  }));
}

/** Total items awaiting the agent's action across ALL the agency's active projects
 *  — the top-nav "Messages (N)" badge. Reuses the summary's per-project waitingAgent
 *  so "waiting on agent" keeps ONE definition (no logic drift). */
/** Lightweight "needs your action" tally for the top-nav Inbox badge. Uses the
 *  SAME deriveLineState + itemWaitingOn as the inbox, but fed by TWO batched queries
 *  across ALL the viewer's active projects — instead of the full per-project thread
 *  assembly getAgentInboxSummary does (org display, pricing, categories), which the
 *  badge was running on EVERY navigation → ~8s on a single pinned connection (Liam
 *  2026-11-19). `who` = the side we tally ('agent' | 'supplier'). Counts briefed
 *  (project,provider,item) keys, so it can differ from the fully-resolved inbox by
 *  lines that don't resolve — acceptable for a badge. */
async function countActionItems(viewerOrg, who) {
  const projCond = who === 'agent'
    ? 'p.org_id = $1'
    : `EXISTS (SELECT 1 FROM messages mm WHERE mm.project_id = p.id
                AND (mm.from_org_id = $1 OR mm.to_org_id = $1) AND mm.deleted_at IS NULL)`;
  const projs = await pool.query(
    `SELECT p.id, p.org_id FROM projects p
      WHERE p.deleted_at IS NULL AND COALESCE(p.status,'draft') NOT IN ('completed','archived')
        AND ${projCond}`,
    [viewerOrg]
  );
  if (!projs.rows.length) return 0;
  const projectIds = projs.rows.map((r) => r.id);
  const agencyOf = new Map(projs.rows.map((r) => [r.id, r.org_id]));

  const [rel, ev] = await Promise.all([
    pool.query(
      `SELECT mr.project_item_id, m.project_id, m.from_org_id, m.to_org_id, m.created_at
         FROM message_relations mr
         JOIN messages m ON m.id = mr.message_id AND m.deleted_at IS NULL
         JOIN project_items pi ON pi.id = mr.project_item_id AND pi.deleted_at IS NULL AND pi.parent_id IS NULL
        WHERE m.project_id = ANY($1::uuid[])
        ORDER BY m.created_at ASC`,
      [projectIds]
    ),
    pool.query(
      `SELECT mr.project_item_id, m.project_id, m.from_org_id, m.to_org_id,
              me.status, me.price_current, me.price_override, me.note, me.created_at
         FROM message_events me
         JOIN message_relations mr ON mr.id = me.message_relation_id
         JOIN messages m ON m.id = me.message_id
        WHERE m.project_id = ANY($1::uuid[])
        ORDER BY me.created_at ASC`,
      [projectIds]
    ),
  ]);

  const keyFor = (projectId, agency, from, to, item) =>
    `${projectId}|${from === agency ? to : from}|${item}`;

  const evByKey = new Map();
  for (const r of ev.rows) {
    const agency = agencyOf.get(r.project_id);
    const key = keyFor(r.project_id, agency, r.from_org_id, r.to_org_id, r.project_item_id);
    let arr = evByKey.get(key);
    if (!arr) { arr = []; evByKey.set(key, arr); }
    arr.push({
      status: r.status, side: r.from_org_id === agency ? 'buyer' : 'seller',
      createdAt: r.created_at, note: r.note, priceCurrent: r.price_current, priceOverride: r.price_override,
    });
  }
  const lastMsg = new Map(); const agencyOfKey = new Map();
  for (const r of rel.rows) {
    const agency = agencyOf.get(r.project_id);
    const key = keyFor(r.project_id, agency, r.from_org_id, r.to_org_id, r.project_item_id);
    lastMsg.set(key, { from: r.from_org_id, at: r.created_at }); // ASC → last wins
    agencyOfKey.set(key, agency);
  }

  let count = 0;
  for (const [key, agency] of agencyOfKey) {
    const evs = evByKey.get(key) || [];
    const state = mev.deriveLineState(evs, { briefed: true });
    const lastAction = evs.length ? evs[evs.length - 1].createdAt : null;
    const lm = lastMsg.get(key);
    const it = {
      status: state.status,
      buyerAccepted: state.buyerAccepted,
      sellerAccepted: state.sellerAccepted,
      lastMessageBy: lm ? (lm.from === agency ? 'buyer' : 'seller') : null,
      lastEventIsMessage: !!(lm && lastAction && new Date(lm.at) > new Date(lastAction)),
    };
    if (itemWaitingOn(it) === who) count++;
  }
  return count;
}

async function getAgentActionCount(agencyOrgId) {
  return countActionItems(agencyOrgId, 'agent');
}

/** Supplier home dashboard stats (Liam 2026-10-30): needs-reply (items where it's
 *  the supplier's turn), published listings (active + approved items), live projects
 *  (active projects the supplier is on), and confirmed work (£ of agreed/booked
 *  lines). The negotiation-state metrics reuse the SAME thread assembly as the inbox
 *  so they can't drift from it. */
async function getSupplierHomeStats(supplierOrgId) {
  const projs = await pool.query(
    // Projects the supplier is engaged on = those it's a message party in (the
    // conversation is the source of truth; project_providers can be incomplete).
    `SELECT DISTINCT p.id FROM projects p
       JOIN messages m ON m.project_id = p.id
        AND (m.from_org_id = $1 OR m.to_org_id = $1) AND m.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
        AND COALESCE(p.status, 'draft') NOT IN ('completed', 'archived')`,
    [supplierOrgId]
  );
  const liveProjects = projs.rows.length;

  let needsReply = 0, confirmedWork = 0;
  const seen = new Set();
  for (const p of projs.rows) {
    const { threads } = await assembleThreads('supplier', supplierOrgId, p.id);
    for (const t of threads) {
      for (const it of t.items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        if (isDeclined(it.status)) continue;
        if (itemWaitingOn(it) === 'supplier') needsReply++;
        const agreed = it.status === 'booked' || (it.buyerAccepted && it.sellerAccepted);
        if (agreed) confirmedWork += Number(it.priceCurrent ?? it.priceRef ?? 0);
      }
    }
  }

  const listings = await pool.query(
    `SELECT count(*)::int AS n FROM items
      WHERE org_id = $1 AND deleted_at IS NULL
        AND status = 'active' AND approval_status = 'approved'`,
    [supplierOrgId]
  );

  return {
    needsReply,
    publishedListings: listings.rows[0]?.n ?? 0,
    liveProjects,
    confirmedWork: Math.round(confirmedWork),
  };
}

/** Supplier home "Inbox" card feed (Liam 2026-10-30): the supplier's live line items
 *  across projects — item name, requesting agency, status + price — each linking to
 *  that conversation. Needs-reply items first, then most-recent activity. Reuses the
 *  thread assembly so status/price match the inbox. */
async function getSupplierInboxItems(supplierOrgId, limit = 6) {
  const projs = await pool.query(
    // Projects the supplier is engaged on = those it's a message party in (the
    // conversation is the source of truth; project_providers can be incomplete).
    `SELECT DISTINCT p.id FROM projects p
       JOIN messages m ON m.project_id = p.id
        AND (m.from_org_id = $1 OR m.to_org_id = $1) AND m.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
        AND COALESCE(p.status, 'draft') NOT IN ('completed', 'archived')`,
    [supplierOrgId]
  );
  const items = [];
  const seen = new Set();
  for (const p of projs.rows) {
    const { project, threads } = await assembleThreads('supplier', supplierOrgId, p.id);
    let agencyName = null;
    for (const t of threads) {
      if (!agencyName) agencyName = t.agencyName;
      const last = t.messages[t.messages.length - 1];
      const lastMessageAt = last ? last.createdAt : null;
      for (const it of t.items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        if (isDeclined(it.status)) continue;
        items.push({
          projectId: p.id,
          projectName: project?.name ?? null,
          itemId: it.itemId ?? it.id,
          name: it.name,
          quantity: it.quantity ?? null,
          agencyName: t.agencyName,
          status: it.status,
          buyerAccepted: it.buyerAccepted,
          sellerAccepted: it.sellerAccepted,
          lastMessageBy: it.lastMessageBy,
          lastEventIsMessage: it.lastEventIsMessage,
          supplierEngaged: it.supplierEngaged,
          price: it.priceCurrent ?? it.priceRef ?? null,
          waitingSupplier: itemWaitingOn(it) === 'supplier',
          lastMessageAt,
        });
      }
    }
    // The engagement's SOW appears as its own feed item (kind='sow'), matching how
    // it shows in the inbox rail. Supplier authors it, so visible in any status;
    // draft / updates-required (reviewed) are the supplier's turn.
    const sowRow = await pool.query(
      `SELECT id, status, updated_at FROM project_documents
        WHERE project_id = $1 AND type = 'sow' AND org_id = $2 AND deleted_at IS NULL
        ORDER BY updated_at DESC LIMIT 1`,
      [p.id, supplierOrgId]
    );
    if (sowRow.rows[0]) {
      const sow = sowRow.rows[0];
      items.push({
        projectId: p.id, projectName: project?.name ?? null,
        itemId: 'sow:' + sow.id, name: 'Statement of Work', quantity: null,
        agencyName, status: sow.status, kind: 'sow', sowStatus: sow.status,
        buyerAccepted: null, sellerAccepted: null, lastMessageBy: null,
        lastEventIsMessage: false, supplierEngaged: true, price: null,
        waitingSupplier: sow.status === 'draft' || sow.status === 'reviewed' || sow.status === 'agent_approved',
        lastMessageAt: sow.updated_at,
      });
    }
  }
  items.sort((a, b) => {
    if (a.waitingSupplier !== b.waitingSupplier) return a.waitingSupplier ? -1 : 1;
    return (b.lastMessageAt ?? '') < (a.lastMessageAt ?? '') ? -1 : 1;
  });
  return items.slice(0, limit);
}

/** Supplier Messages landing (Liam 2026-10-30): one card per engaged project, each
 *  with the requesting agency, a supplier-perspective rollup pill and its line items
 *  (name / status / price) — the agent landing's shape, but items instead of
 *  suppliers. Rollup: action_required (your turn) → awaiting_agency → all_confirmed. */
async function getSupplierInboxSummary(supplierOrgId) {
  // SET-BASED (Liam 2026-11-19) — was a SEQUENTIAL per-project assembleThreads loop
  // (even slower than the agency's). Same batched approach + the same
  // deriveLineState / itemWaitingOn / lineTotals, so every field is identical.
  const projs = await pool.query(
    `SELECT DISTINCT p.id, p.name, p.org_id FROM projects p
       JOIN messages m ON m.project_id = p.id
        AND (m.from_org_id = $1 OR m.to_org_id = $1) AND m.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
        AND COALESCE(p.status, 'draft') NOT IN ('completed', 'archived')`,
    [supplierOrgId]
  );
  if (!projs.rows.length) return [];
  const projectIds = projs.rows.map((r) => r.id);

  const [relR, evR, sowR, engR] = await Promise.all([
    pool.query(
      `SELECT mr.project_item_id, m.project_id, m.from_org_id, m.body, m.created_at
         FROM message_relations mr
         JOIN messages m ON m.id = mr.message_id AND m.deleted_at IS NULL
         JOIN project_items pi ON pi.id = mr.project_item_id AND pi.deleted_at IS NULL AND pi.parent_id IS NULL
        WHERE m.project_id = ANY($1::uuid[])
        ORDER BY m.created_at ASC`, [projectIds]),
    pool.query(
      `SELECT mr.project_item_id, m.project_id, m.from_org_id,
              me.status, me.price_current, me.price_override, me.note, me.created_at
         FROM message_events me
         JOIN message_relations mr ON mr.id = me.message_relation_id
         JOIN messages m ON m.id = me.message_id
        WHERE m.project_id = ANY($1::uuid[])
        ORDER BY me.created_at ASC`, [projectIds]),
    pool.query(
      `SELECT DISTINCT ON (project_id) project_id, status FROM project_documents
        WHERE project_id = ANY($1::uuid[]) AND type = 'sow' AND org_id = $2 AND deleted_at IS NULL
        ORDER BY project_id, updated_at DESC`, [projectIds, supplierOrgId]),
    pool.query(
      `SELECT id, project_id FROM project_providers
        WHERE project_id = ANY($1::uuid[]) AND provider_org_id = $2 AND deleted_at IS NULL`, [projectIds, supplierOrgId]),
  ]);

  const agencyOf = new Map(projs.rows.map((r) => [r.id, r.org_id]));
  const engBy = new Map();
  for (const r of engR.rows) engBy.set(r.project_id, r.id);

  const eventsByKey = new Map(); // `${project}|${item}` → events (side relative to agency)
  for (const r of evR.rows) {
    const agency = agencyOf.get(r.project_id);
    const key = `${r.project_id}|${r.project_item_id}`;
    let arr = eventsByKey.get(key); if (!arr) { arr = []; eventsByKey.set(key, arr); }
    arr.push({ status: r.status, side: r.from_org_id === agency ? 'buyer' : 'seller',
               createdAt: r.created_at, note: r.note, priceCurrent: r.price_current, priceOverride: r.price_override });
  }

  const byProj = new Map(); // project → { items:Set }
  const lastMsgItem = new Map(); // `${project}|${item}` → { from, at }
  const engaged = new Set(); // `${project}|${item}` the supplier has messaged on
  for (const r of relR.rows) {
    let g = byProj.get(r.project_id); if (!g) { g = { items: new Set() }; byProj.set(r.project_id, g); }
    g.items.add(r.project_item_id);
    const ik = `${r.project_id}|${r.project_item_id}`;
    lastMsgItem.set(ik, { from: r.from_org_id, at: r.created_at });
    if (r.from_org_id === supplierOrgId) engaged.add(ik);
  }

  const itemIds = [], engIds = [];
  for (const [pid, g] of byProj) {
    const eng = engBy.get(pid);
    if (!eng) continue;
    for (const item of g.items) { itemIds.push(item); engIds.push(eng); }
  }
  const priceMap = await resolvedLinesForPairs(itemIds, engIds);

  const sowBy = new Map();
  for (const r of sowR.rows) sowBy.set(r.project_id, r.status);
  const agencyDisplay = await fetchOrgDisplay('supplier', [...new Set(projs.rows.map((r) => r.org_id))]);

  const out = [];
  for (const p of projs.rows) {
    const g = byProj.get(p.id);
    const eng = engBy.get(p.id);
    if (!g || !eng) continue;
    const agency = p.org_id;
    const items = [];
    let waitingSupplier = 0, allAgreed = true, confirmedWork = 0, lastMessageAt = null;
    for (const itemId of g.items) {
      const raw = priceMap.get(`${itemId}|${eng}`);
      if (!raw) continue;
      const evs = eventsByKey.get(`${p.id}|${itemId}`) || [];
      const state = mev.deriveLineState(evs, { briefed: true });
      if (isDeclined(state.status)) continue;
      const ik = `${p.id}|${itemId}`;
      const lastAction = evs.length ? evs[evs.length - 1].createdAt : null;
      const lm = lastMsgItem.get(ik);
      const lastMessageBy = lm ? (lm.from === agency ? 'buyer' : 'seller') : null;
      const lastEventIsMessage = !!(lm && lastAction && new Date(lm.at) > new Date(lastAction));
      const { original, revised } = lineTotals(raw);
      const price = revised ?? original ?? null;
      const it = { status: state.status, buyerAccepted: state.buyerAccepted, sellerAccepted: state.sellerAccepted, lastMessageBy, lastEventIsMessage };
      const agreed = state.status === 'booked' || (state.buyerAccepted && state.sellerAccepted);
      if (!agreed) allAgreed = false;
      if (agreed) confirmedWork += Number(price ?? 0);
      if (itemWaitingOn(it) === 'supplier') waitingSupplier++;
      if (lm?.at && (!lastMessageAt || lm.at > lastMessageAt)) lastMessageAt = lm.at;
      items.push({
        itemId: raw.item_id ?? itemId,
        name: raw.name,
        status: state.status,
        buyerAccepted: state.buyerAccepted,
        sellerAccepted: state.sellerAccepted,
        lastMessageBy, lastEventIsMessage,
        lastMessageAt: lm?.at ?? null,
        supplierEngaged: engaged.has(ik),
        price: price == null ? null : Number(price),
      });
    }
    if (!items.length) continue;
    // The supplier authors the SOW, so they see it in any status. Fold it into the
    // self-status: draft / updates-required (reviewed / agent_approved) = their turn;
    // in_review = waiting on the agency; approved / executed = done.
    const sowStatus = sowBy.get(p.id) ?? null;
    let status;
    if (waitingSupplier > 0 || sowStatus === 'draft' || sowStatus === 'reviewed' || sowStatus === 'agent_approved') status = 'action_required';
    else if (sowStatus === 'in_review') status = 'awaiting_agency';
    else if (allAgreed) status = 'all_confirmed';
    else status = 'awaiting_agency';
    out.push({ projectId: p.id, projectName: p.name, agencyName: agencyDisplay.get(agency)?.name ?? null, status, sowStatus, items, waitingSupplier, lastMessageAt, confirmedWork: Math.round(confirmedWork) });
  }
  return out;
}

/** Total line items awaiting the SUPPLIER's action across all their active projects
 *  — the supplier's top-nav "Messages (N)" badge (mirror of getAgentActionCount).
 *  Reuses the supplier summary's per-project waitingSupplier so "waiting on the
 *  supplier" keeps ONE definition (itemWaitingOn), no logic drift. */
async function getSupplierActionCount(supplierOrgId) {
  return countActionItems(supplierOrgId, 'supplier');
}

module.exports = {
  listSupplierProjects, sendOutreach, getSupplierThreads, getAgentThreads,
  getAgentInboxSummary, getProjectOverview, getAgentActionCount, getSupplierActionCount, getSupplierHomeStats,
  getSupplierInboxItems, getSupplierInboxSummary, reply, getLineConversation,
  getActiveAddContext, addItemToActiveProject,
};
