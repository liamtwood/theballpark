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

/** The InboxThreadItem (client contract). Prices = the pricing module; approval
 *  state = deriveLineState over the (provider × item) events; `line` = the SAME
 *  QuoteLine the Final Quote renders, resolved against the provider overlay. */
function toThreadItem(raw, state, line) {
  const { original, revised } = lineTotals(raw);
  return {
    id: raw.id,
    itemId: raw.item_id ?? raw.id,
    name: raw.name,
    description: raw.description || null,
    status: state.status,
    priceRef: original == null ? null : Number(original),
    priceCurrent: revised == null ? null : Number(revised),
    unitPriceRef: raw.f_base == null ? null : Number(raw.f_base),
    unitPriceCurrent: raw.q_current == null ? null : Number(raw.q_current),
    flatTotal: raw.q_override == null ? null : Number(raw.q_override),
    hasOpenQuestion: false, // buildup/question children shelved (project_buildup_shelved)
    quantity: raw.r_qty == null ? null : Number(raw.r_qty),
    unit: raw.unit ?? null,
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
  const projRow = await pool.query(
    `SELECT id, org_id, name, description, event_date, venue_name, client_name, currency
       FROM projects WHERE id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  if (!projRow.rows.length) throw httpErr('Project not found', 404);
  const project = projRow.rows[0];
  const agencyOrgId = project.org_id;
  if (viewer === 'agency' && agencyOrgId !== callerOrgId) throw httpErr('Project not found', 404);

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
        const line = providerId ? await projectLine.lineByIdForProvider(pool, itemId, providerId) : null;
        items.push(toThreadItem(raw, state, line));
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
    name: project.name ?? null,
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
  if (it.status === 'booked' || (it.buyerAccepted && it.sellerAccepted)) return null;
  if (isDeclined(it.status)) return null;
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
  const projs = await pool.query(
    `SELECT p.id FROM projects p
      WHERE p.org_id = $1 AND p.deleted_at IS NULL
        AND COALESCE(p.status, 'draft') NOT IN ('completed', 'archived')
        AND EXISTS (SELECT 1 FROM project_providers pp
                     WHERE pp.project_id = p.id AND pp.deleted_at IS NULL)
      ORDER BY p.updated_at DESC`,
    [agencyOrgId]
  );

  const out = [];
  for (const p of projs.rows) {
    const { project, threads } = await assembleThreads('agency', agencyOrgId, p.id);
    if (!threads.length) continue;

    // Roll up per supplier (a supplier can span multiple category threads).
    const bySupplier = new Map();
    for (const t of threads) {
      let g = bySupplier.get(t.supplierOrgId);
      if (!g) { g = { name: t.supplierName, items: [], lastMessage: null, lastMessageAt: null }; bySupplier.set(t.supplierOrgId, g); }
      g.items.push(...t.items);
      const last = t.messages[t.messages.length - 1];
      if (last && (!g.lastMessageAt || new Date(last.createdAt) > new Date(g.lastMessageAt))) {
        g.lastMessage = last.body; g.lastMessageAt = last.createdAt;
      }
    }

    const suppliers = [];
    let waitingAgent = 0, waitingSupplier = 0, itemCount = 0;
    for (const g of bySupplier.values()) {
      const seen = new Set();
      let wa = 0, ws = 0, n = 0, actionItemId = null;
      for (const it of g.items) {
        if (seen.has(it.id)) continue;
        seen.add(it.id);
        if (isDeclined(it.status)) continue;
        n++;
        const w = itemWaitingOn(it);
        if (w === 'agent') { wa++; if (!actionItemId) actionItemId = it.id; }
        else if (w === 'supplier') ws++;
      }
      suppliers.push({
        name: g.name, itemCount: n, waitingAgent: wa, waitingSupplier: ws,
        actionRequired: wa > 0, actionItemId,
        lastMessage: truncate(g.lastMessage, 240), lastMessageAt: g.lastMessageAt,
      });
      waitingAgent += wa; waitingSupplier += ws; itemCount += n;
    }

    out.push({
      id: p.id, name: project.name, clientName: project.clientName ?? null,
      suppliers, itemCount, waitingAgent, waitingSupplier, actionRequired: waitingAgent > 0,
    });
  }
  return out;
}

/** Live-project overview metrics (agency): value of both-sides-agreed items,
 *  agreed vs total item counts, and how many supplier threads still have an
 *  open item. Cancelled/declined lines excluded. org from JWT. */
async function getProjectOverview(agencyOrgId, projectId) {
  const { threads } = await assembleThreads('agency', agencyOrgId, projectId);
  let confirmedTotal = 0, agreedItems = 0, totalItems = 0, openThreads = 0;
  const seen = new Set();
  for (const t of threads) {
    let threadOpen = false;
    for (const it of t.items) {
      if (seen.has(it.id)) continue;
      seen.add(it.id);
      if (isDeclined(it.status)) continue;
      totalItems++;
      const agreed = it.status === 'booked' || (it.buyerAccepted && it.sellerAccepted);
      if (agreed) { agreedItems++; confirmedTotal += Number(it.priceCurrent ?? it.priceRef ?? 0); }
      else threadOpen = true;
    }
    if (threadOpen) openThreads++;
  }
  return { confirmedTotal, agreedItems, totalItems, openThreads };
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

  const results = [];
  let threadCount = 0;
  await withTransaction(async (client) => {
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
          `SELECT pi.id FROM project_items pi
            WHERE pi.project_id = $1 AND pi.project_category_id = $2
              AND pi.parent_id IS NULL AND pi.deleted_at IS NULL
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
           `Quote request: ${catName}`, `We'd like your quote for ${catName}.`]
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

module.exports = {
  listSupplierProjects, sendOutreach, getSupplierThreads, getAgentThreads,
  getAgentInboxSummary, getProjectOverview, reply, getLineConversation,
};
