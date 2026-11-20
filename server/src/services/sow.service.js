// pV2-SOW-01 (Phase 1, rebuild) — the SOW service over the 0039/0040 document
// cluster (project_documents + _lines + _signatures). v1 = SOW rows only,
// CONTENT-AUTHORED: the party that owns the doc authors the whole SOW (line
// items, prices, deposit, terms) into `content` (ordered sections). The
// structured project_document_lines / catalogue-pull is reserved for a later
// enhancement, so v1 needs NO cross-org line materialisation and NO new DDL.
//
// MODEL (0040, bidirectional): org_id = THE AUTHOR; the engaged COUNTERPARTY is
// the other party on the engagement (project_providers). The counterparty signs
// first on the unsigned draft, the author counter-signs → executed. There is NO
// confirm step. Supplier-authored (org_id = supplier) is the primary v1 flow;
// agency-authored rides the same code (org_id = agency).
//
// SECURITY: org_id is ALWAYS the JWT caller's (routes pass req.user.org_id); the
// per-request pinned client carries the org GUC, so RLS scopes every read/write.
//   • Reads are ENGAGEMENT-SCOPED by the RLS policies, never by an org_id=:me
//     filter — filtering org_id=:me would silently drop counterparty-authored
//     docs (most of them in the supplier-authored flow). We SELECT and let the
//     unified counterparty_read + agency _all policies define the visible set.
//   • The signature + status machine is the gated SECURITY DEFINER document_sign
//     (derives the party from the session + engagement; validates p_role). We
//     pass the caller's org_type as the role; the DB re-derives and rejects a
//     mismatch, so a forged role can't sign out of turn.
//   • Cross-org counterparty display uses the sanctioned bypasses
//     (supplier_directory / org_contact), exactly like inbox.service.

const pool = require('../db/pool');
const mev = require('./message-event.service');
const { lineTotal } = require('./line-pricing');
const ai = require('./ai.service');
const { withTransaction } = require('../db/with-transaction');

const PLATFORM_FEE_PCT = 3; // Ballpark platform fee, shown on every SOW (pV2-SOW-01).

/** The chosen variant's own description, resolved from the item's variant
 *  definitions by matching the chosen value (same logic as project-line). */
function variantDescriptionFrom(variant, attributes) {
  const dims = attributes && attributes.variants && attributes.variants.dimensions;
  if (!variant || !variant.values || !Array.isArray(dims)) return null;
  const parts = [];
  for (const dim of dims) {
    const chosen = variant.values[dim.name];
    if (chosen == null) continue;
    const val = (dim.values || []).find((v) => v.value === chosen);
    if (val && val.description) parts.push(val.description);
  }
  return parts.length ? parts.join('\n\n') : null;
}

// Freeze the agreed production items into project_document_lines at execution, so
// a signed SOW shows WHAT WAS SIGNED — not the live thread (which can still move).
// Supplier-authored flow (primary): the author (= supplier) reads its own items +
// the shared accept events, and writes the lines for its own document, all under
// RLS. Both-accepted only (the agreed scope). Best-effort: a failure leaves the
// SOW executed with no snapshot (falls back to the live derivation), never blocks
// signing. Idempotent — replaces any existing snapshot for the document.
async function snapshotExecutedLines(doc) {
  const providerId = doc.project_provider_id;
  if (!providerId) return;
  const proj = await pool.query('SELECT org_id FROM projects WHERE id = $1', [doc.project_id]);
  const agencyOrgId = proj.rows[0] && proj.rows[0].org_id;

  const r = await pool.query(
    `SELECT pi0.id AS project_item_id,
            COALESCE(q.name, pi0.name)               AS name,
            COALESCE(q.description, pi0.description)  AS spec,
            COALESCE(q.quantity, pi0.quantity)        AS quantity,
            COALESCE(q.unit, pi0.unit)                AS unit,
            COALESCE(q.currency, pi0.currency)        AS currency,
            COALESCE(q.variant, pi0.variant)          AS r_variant,
            COALESCE(q.install_description, pi0.install_description, i.install_description) AS install_description,
            COALESCE(q.attributes, pi0.attributes)    AS attributes,
            pi0.base_price AS f_base, q.price_current AS q_current, q.price_override AS q_override,
            pi0.installed AS installed,
            COALESCE(q.install_cost, pi0.install_cost) AS r_ic, COALESCE(q.install_unit, pi0.install_unit) AS r_iu,
            i.install_cost AS i_ic, i.install_unit AS i_iu,
            i.serves AS i_serves, i.time_unit AS i_time_unit, i.ref AS i_ref,
            i.attributes -> 'price_tiers' AS price_tiers
       FROM project_items pi0
       LEFT JOIN project_item_quotes q ON q.project_item_id = pi0.id AND q.project_provider_id = $1 AND q.deleted_at IS NULL
       LEFT JOIN items i ON i.id = pi0.item_id
      WHERE pi0.project_id = $2 AND pi0.deleted_at IS NULL AND pi0.parent_id IS NULL`,
    [providerId, doc.project_id]
  );

  // Accept events for the project, grouped by item (side = agency → buyer).
  const ev = await pool.query(
    `SELECT mr.project_item_id, m.from_org_id, me.status, me.created_at
       FROM message_events me
       JOIN message_relations mr ON mr.id = me.message_relation_id
       JOIN messages m ON m.id = me.message_id
      WHERE m.project_id = $1
      ORDER BY me.created_at ASC`,
    [doc.project_id]
  );
  const eventsByItem = new Map();
  for (const row of ev.rows) {
    const side = row.from_org_id === agencyOrgId ? 'buyer' : 'seller';
    const arr = eventsByItem.get(row.project_item_id) || [];
    arr.push({ status: row.status, side, createdAt: row.created_at });
    eventsByItem.set(row.project_item_id, arr);
  }

  const lines = [];
  for (const row of r.rows) {
    const st = mev.deriveLineState(eventsByItem.get(row.project_item_id) || [], { briefed: true });
    if (!(st.buyerAccepted && st.sellerAccepted)) continue; // only the agreed scope
    const tiers = Array.isArray(row.price_tiers) ? row.price_tiers : null;
    const upcharge = row.r_variant && row.r_variant.upcharge ? Number(row.r_variant.upcharge) : 0;
    const total = lineTotal({
      priceCurrent: row.q_current, basePrice: row.f_base, priceTiers: tiers, quantity: row.quantity,
      installed: row.installed, installCost: row.r_ic != null ? row.r_ic : row.i_ic,
      installUnit: row.r_iu || row.i_iu, variantUpcharge: upcharge, flatTotal: row.q_override, honourFlat: true,
    });
    const unitPrice = row.q_current != null ? Number(row.q_current) : (row.f_base != null ? Number(row.f_base) : null);
    const variantLabel = row.r_variant && row.r_variant.label ? String(row.r_variant.label) : null;
    const unitSize = row.unit === 'platter' ? (row.i_serves != null ? String(row.i_serves) : null)
      : (row.unit === 'time' ? (row.i_time_unit || null) : null);
    const approval = st.buyerAcceptedAt && st.sellerAcceptedAt
      ? (new Date(st.buyerAcceptedAt) > new Date(st.sellerAcceptedAt) ? st.buyerAcceptedAt : st.sellerAcceptedAt)
      : null;
    lines.push({
      org_id: doc.org_id, project_item_id: row.project_item_id, name: row.name, spec: row.spec,
      quantity: row.quantity, unit: row.unit, unit_price: unitPrice, line_total: total,
      currency: row.currency, source: 'agreed', approval_date: approval, sku: row.i_ref,
      unit_size: unitSize, variant: variantLabel,
      variant_description: variantDescriptionFrom(row.r_variant, row.attributes),
      install_description: row.install_description,
    });
  }

  // project_document_lines is SELECT-only to the app role (server-side-only by design,
  // 0040) — write the snapshot through the freeze_document_lines SECURITY DEFINER
  // (0065): atomic, party-gated, replaces the document's snapshot wholesale.
  await pool.query('SELECT public.freeze_document_lines($1, $2::jsonb)', [doc.id, JSON.stringify(lines)]);
}

function httpErr(message, status) {
  const e = new Error(message);
  e.status = status;
  return e;
}

// A document is the AUTHOR's; the engaged counterparty reads + signs. We only
// ever expose fields under the doc's own RLS — no cross-org table is touched here
// beyond the audited directories in resolveParties().
function toSowDto(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || null,
    type: row.type,
    status: row.status,
    content: row.content ?? {},
    presentation: row.presentation ?? {},
    depositPct: row.deposit_pct != null ? Number(row.deposit_pct) : null,
    projectId: row.project_id,
    projectProviderId: row.project_provider_id,
    orgId: row.org_id, // the author
    supplierOrgId: row.supplier_org_id, // the supplier party (denormalised)
    supersedesDocumentId: row.supersedes_document_id || null,
    // The supplier's standard T&C PDF (orgs.terms_pdf_url) — embedded as Annex A /
    // Appendix A in the document. Resolved own-org for the supplier author (the
    // party that generates the signed doc); null cross-org for the agency viewer.
    termsPdfUrl: row.supplier_terms_pdf_url ?? null,
    issuedAt: row.issued_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── cross-org party display (names only — org_contact/supplier_directory expose
//    name/logo/city, which is enough for the SOW parties header; full legal
//    address cross-org is a later widening, flagged in the ship notes) ─────────
async function resolveParties(agencyOrgId, supplierOrgId) {
  // The caller reads its OWN org directly (own-org RLS); the counterparty via the
  // audited directory for its direction.
  const out = { agency: null, supplier: null };
  const own = await pool.query('SELECT id, name FROM orgs WHERE id = ANY($1::uuid[])', [
    [agencyOrgId, supplierOrgId].filter(Boolean),
  ]);
  for (const r of own.rows) {
    if (r.id === agencyOrgId) out.agency = { id: r.id, name: r.name };
    if (r.id === supplierOrgId) out.supplier = { id: r.id, name: r.name };
  }
  // Fill the counterparty (the side own-org RLS couldn't see) via the bypass.
  const missingSupplier = !out.supplier && supplierOrgId;
  const missingAgency = !out.agency && agencyOrgId;
  if (missingSupplier) {
    const r = await pool.query('SELECT id, name, logo_url, city FROM supplier_directory WHERE id = $1', [supplierOrgId]);
    if (r.rows[0]) out.supplier = { id: r.rows[0].id, name: r.rows[0].name, logoUrl: r.rows[0].logo_url, city: r.rows[0].city };
  }
  if (missingAgency) {
    const r = await pool.query('SELECT c.name, c.logo_url, c.city FROM public.org_contact($1) c', [agencyOrgId]);
    if (r.rows[0]) out.agency = { id: agencyOrgId, name: r.rows[0].name, logoUrl: r.rows[0].logo_url, city: r.rows[0].city };
  }
  return out;
}

async function signaturesFor(documentId) {
  const r = await pool.query(
    `SELECT role, name, title, signed_at FROM project_document_signatures
      WHERE document_id = $1 ORDER BY signed_at ASC`,
    [documentId]
  );
  return r.rows.map((s) => ({ role: s.role, name: s.name, title: s.title, signedAt: s.signed_at }));
}

// ── create a draft SOW (the caller is the AUTHOR) ────────────────────────────
// The caller picks the engagement (projectProviderId) they're authoring for; we
// derive project_id + the supplier party from it. org_id = the caller. The DB
// engagement guard backstops that the caller is actually a party to it.
async function createDraft({ orgId, orgType, userId, projectId, supplierOrgId, name, content, depositPct }) {
  // Resolve the engagement from (project, supplier party) — UNIQUE(project,
  // provider) makes it exact, so the client never needs the raw engagement PK.
  // The supplier author IS the caller; an agency author names the supplier.
  const supplierParty = orgType === 'supplier' ? orgId : supplierOrgId;
  if (!supplierParty) throw httpErr('supplierOrgId is required when the agency authors', 400);
  const pp = await pool.query(
    `SELECT id, project_id, org_id, provider_org_id FROM project_providers
      WHERE project_id = $1 AND provider_org_id = $2 AND deleted_at IS NULL`,
    [projectId, supplierParty]
  );
  if (!pp.rows[0]) throw httpErr('No engagement for this project + supplier', 404);
  const eng = pp.rows[0];
  if (orgId !== eng.org_id && orgId !== eng.provider_org_id) {
    throw httpErr('Not a party to this engagement', 403);
  }
  const r = await pool.query(
    `INSERT INTO project_documents
       (org_id, project_id, project_provider_id, supplier_org_id, name, type, status, content, deposit_pct, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,'sow','draft',$6::jsonb,$7,$8,$8)
     RETURNING *`,
    [orgId, eng.project_id, eng.id, eng.provider_org_id, name, JSON.stringify(content ?? {}), depositPct ?? null, userId ?? null]
  );
  return toSowDto(r.rows[0]);
}

// ── list the SOWs on a project visible to the caller ─────────────────────────
// No org_id filter — RLS (author _all + counterparty_read) defines the visible
// set, so the caller sees both the SOWs it authored AND the counterparty-authored
// ones on its engagements. Filtering org_id=:me here would drop the latter.
// The frozen snapshot lines (project_document_lines) → the SowProductionItem shape
// the client's Production table/blocks already consume, so an executed SOW renders
// identically to the live draft, just from frozen data.
function toSowLineDto(row) {
  return {
    itemId: row.project_item_id,
    item: row.name,
    sku: row.sku || null,
    qty: row.quantity != null ? Number(row.quantity) : null,
    unit: row.unit || null,
    unitSize: row.unit_size || null,
    variant: row.variant || null,
    total: row.line_total != null ? Number(row.line_total) : null,
    description: row.spec || null,
    variantDescription: row.variant_description || null,
    installDescription: row.install_description || null,
  };
}
async function linesFor(documentIds) {
  if (!documentIds.length) return new Map();
  const r = await pool.query(
    `SELECT * FROM project_document_lines WHERE document_id = ANY($1::uuid[]) ORDER BY created_at ASC`,
    [documentIds]
  );
  const m = new Map();
  for (const row of r.rows) {
    const arr = m.get(row.document_id) || [];
    arr.push(toSowLineDto(row));
    m.set(row.document_id, arr);
  }
  return m;
}

async function listForProject(projectId, viewerOrgId) {
  // TWO-LAYER isolation: RLS scopes the rows, AND we mirror the counterparty_read
  // predicate at the app layer (as inbox.service does on its reads) so SOW
  // visibility never hangs on the single DB role-flip control. This is NOT an
  // org_id=:me filter (that would drop counterparty-authored docs) — it is
  // "author OR a party to the doc's engagement", exactly the RLS policy's shape.
  const r = await pool.query(
    `SELECT d.*, (SELECT terms_pdf_url FROM orgs WHERE id = d.supplier_org_id) AS supplier_terms_pdf_url
       FROM project_documents d
      WHERE d.project_id = $1 AND d.deleted_at IS NULL
        AND ( d.org_id = $2
           OR d.project_provider_id IN (SELECT id FROM project_providers
                                         WHERE deleted_at IS NULL AND $2 IN (org_id, provider_org_id)) )
      ORDER BY d.created_at DESC`,
    [projectId, viewerOrgId]
  );
  const executedIds = r.rows.filter((x) => x.status === 'accepted').map((x) => x.id);
  const linesMap = await linesFor(executedIds);
  return r.rows.map((row) => ({ ...toSowDto(row), lines: linesMap.get(row.id) || null }));
}

// ── one SOW, as a render payload (doc + parties + signatures + the fee line) ──
async function getById(id, viewerOrgId) {
  // Same two-layer belt as listForProject: RLS + the app-layer party predicate,
  // so a single id-fetch can't return a SOW to a non-party even if the DB role
  // ever stops enforcing RLS.
  const r = await pool.query(
    `SELECT d.*, (SELECT terms_pdf_url FROM orgs WHERE id = d.supplier_org_id) AS supplier_terms_pdf_url
       FROM project_documents d
      WHERE d.id = $1 AND d.deleted_at IS NULL
        AND ( d.org_id = $2
           OR d.project_provider_id IN (SELECT id FROM project_providers
                                         WHERE deleted_at IS NULL AND $2 IN (org_id, provider_org_id)) )`,
    [id, viewerOrgId]
  );
  if (!r.rows[0]) throw httpErr('SOW not found', 404); // not visible to this caller
  const row = r.rows[0];
  // Parties: agency = the engagement's org side; supplier = the provider side
  // (supplier_org_id is denormalised to it). Resolve both names.
  const pp = await pool.query('SELECT org_id FROM project_providers WHERE id = $1', [row.project_provider_id]);
  const agencyOrgId = pp.rows[0] ? pp.rows[0].org_id : null;
  const [parties, signatures] = await Promise.all([
    resolveParties(agencyOrgId, row.supplier_org_id),
    signaturesFor(id),
  ]);
  let linesMap = await linesFor(row.status === 'accepted' ? [row.id] : []);
  // Self-heal: if an accepted (Fully Executed) SOW isn't frozen yet, freeze it — but
  // ONLY when the AUTHOR is viewing, so the lines are read under a consistent org
  // context (an agency-first view would read quotes under its own RLS). The primary
  // trigger is co_approve in review(); this is the best-effort backstop.
  if (row.status === 'accepted' && viewerOrgId === row.org_id && !(linesMap.get(row.id) || []).length) {
    try { await snapshotExecutedLines(row); linesMap = await linesFor([row.id]); }
    catch (e) { console.error('[sow] line snapshot on accept failed:', e.message); }
  }
  return { ...toSowDto(row), parties, signatures, platformFeePct: PLATFORM_FEE_PCT, lines: linesMap.get(row.id) || null };
}

// ── edit a draft (author-only; RLS gives the counterparty no write path) ─────
async function updateDraft({ id, userId, name, content, depositPct, presentation }) {
  const sets = [];
  const vals = [];
  let i = 1;
  if (name !== undefined) { sets.push(`name = $${i++}`); vals.push(name); }
  if (content !== undefined) { sets.push(`content = $${i++}::jsonb`); vals.push(JSON.stringify(content)); }
  if (depositPct !== undefined) { sets.push(`deposit_pct = $${i++}`); vals.push(depositPct); }
  if (presentation !== undefined) { sets.push(`presentation = $${i++}::jsonb`); vals.push(JSON.stringify(presentation)); }
  if (!sets.length) throw httpErr('Nothing to update', 400);
  sets.push('updated_at = now()');
  if (userId !== undefined) { sets.push(`updated_by = $${i++}`); vals.push(userId); }
  vals.push(id);
  try {
    const r = await pool.query(
      `UPDATE project_documents SET ${sets.join(', ')} WHERE id = $${i} AND deleted_at IS NULL RETURNING *`,
      vals
    );
    if (!r.rows[0]) throw httpErr('SOW not found or not editable by you', 404); // RLS: not the author
    return toSowDto(r.rows[0]);
  } catch (e) {
    if (e.status) throw e;
    // The freeze trigger raises once the SOW leaves draft (out for review / executed).
    if (/frozen/i.test(e.message || '')) throw httpErr('This SOW is out for review or executed and can no longer be edited — Revise it to a draft, or create a new SOW to amend', 409);
    throw e;
  }
}

// ── review lifecycle transitions (document_review definer) ───────────────────
// send (author: draft→in_review) · revise (author: in_review→draft) ·
// accept / decline (counterparty: in_review→accepted|declined). Party + status
// derived + enforced in the definer.
async function review({ id, action }) {
  try {
    const r = await pool.query('SELECT public.document_review($1, $2) AS status', [id, action]);
    const status = r.rows[0].status;
    // Final execution (co_approve → accepted): FREEZE the agreed lines so the SOW
    // shows WHAT WAS AGREED, immutable. The co_approve caller is the AUTHOR, so the
    // snapshot reads under a consistent org context and writes via the definer.
    // Best-effort — a snapshot failure never undoes a completed approval.
    if (status === 'accepted') {
      const d = await pool.query('SELECT id, project_id, project_provider_id, org_id FROM project_documents WHERE id = $1', [id]);
      if (d.rows[0]) {
        try { await snapshotExecutedLines(d.rows[0]); }
        catch (e) { console.error('[sow] freeze on accept failed:', e.message); }
      }
    }
    return { status };
  } catch (e) {
    const msg = e.message || '';
    if (/not a party/i.test(msg)) throw httpErr('You are not a party to this SOW', 403);
    if (/only the author|counterparty|not a draft|not in review|document not found|unsupported/i.test(msg)) {
      throw httpErr(msg, 409);
    }
    throw e;
  }
}

// ── review comments (generic machine, entity_type='sow') ─────────────────────
// RLS does the gating: review_comment_is_party admits either party to the
// engagement (the counterparty only once status<>'draft'); the owner (author)
// resolves. The request-pinned pool carries the caller's org/user GUCs, so a
// plain query here is already scoped — no app-layer org predicate needed.
function toCommentDto(row) {
  return {
    id: row.id,
    anchorId: row.anchor_id,
    body: row.body,
    status: row.status,
    authorOrgId: row.author_org_id,
    authorUserId: row.author_user_id,
    authorName: row.author_name || null,
    createdAt: row.created_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    mine: row.author_org_id === row.viewer_org_id,
  };
}

/** Every comment on a SOW visible to the caller (RLS: party-only). */
async function listComments({ sowId, viewerOrgId }) {
  const r = await pool.query(
    `SELECT c.*, u.name AS author_name, $2::uuid AS viewer_org_id
       FROM review_comments c
       LEFT JOIN users u ON u.id = c.author_user_id
      WHERE c.entity_type = 'sow' AND c.entity_id = $1
      ORDER BY c.created_at ASC`,
    [sowId, viewerOrgId]
  );
  return r.rows.map(toCommentDto);
}

/** GENERIC status-change history + per-person comment tallies for any entity
 *  (entity_type/entity_id) — one shape for SOW review and admin item approvals.
 *  Each event carries the actor's running comment count on the entity, so a row
 *  shows how many comments that reviewer made. RLS party-only. Sequential queries
 *  (the request pool is a pinned single client — no concurrent query). */
async function history({ entityType, entityId }) {
  // SECURITY DEFINER resolver: the plain users join runs under the viewer's RLS,
  // so a party can't see the COUNTERPARTY's user names (users is RLS-on) and the
  // other side's rows showed "—". The definer resolves names across both parties,
  // gated to a party (0062, Liam 2026-11-19).
  const ev = await pool.query(
    `SELECT status, event, changed_at, changed_by_name, changed_by, commenter_count
       FROM public.document_status_history($1, $2)`,
    [entityType, entityId]
  );
  const total = await pool.query(
    `SELECT count(*)::int AS n FROM review_comments WHERE entity_type = $1 AND entity_id = $2 AND status = 'open'`,
    [entityType, entityId]
  );
  const totalOpen = total.rows[0]?.n ?? 0;
  return {
    // Per-row count: a 'reviewed' row shows that reviewer's own open comments;
    // every other row (send / draft / approve) shows the TOTAL open — i.e. what's
    // outstanding at that handoff. All live (resolved comments drop out).
    events: ev.rows.map((r) => ({
      status: r.status,
      event: r.event || null,
      changedAt: r.changed_at,
      changedByName: r.changed_by_name || null,
      commentCount: r.status === 'reviewed' ? r.commenter_count : totalOpen,
    })),
    commentCount: totalOpen,
  };
}

/** AI suggestions for a draft SOW — scans the engagement conversation + line items and
 *  returns per-item change proposals (description/variant/install/cost) + milestones +
 *  payment/deposit. Nothing is applied: the supplier accepts/declines each in the dialog.
 *  On-demand (one AI call per click), so it's cheap and never runs implicitly. */
async function suggest({ sowId }) {
  const d = await pool.query(
    `SELECT project_id, org_id FROM project_documents
      WHERE id = $1 AND type = 'sow' AND deleted_at IS NULL`,
    [sowId]
  );
  const doc = d.rows[0];
  if (!doc) throw httpErr('SOW not found', 404);
  const { project_id: projectId, org_id: supplierOrg } = doc;

  const pr = await pool.query(
    `SELECT event_date, guest_count, org_id AS agency_org FROM projects WHERE id = $1`,
    [projectId]
  );
  const proj = pr.rows[0] || {};

  const it = await pool.query(
    `SELECT pi.id, pi.name, pi.description, pi.install_description, pi.base_price, pi.quantity
       FROM project_items pi
      WHERE pi.project_id = $1 AND pi.deleted_at IS NULL AND pi.parent_id IS NULL
        AND COALESCE((SELECT org_id FROM items WHERE id = pi.item_id), pi.requested_provider_org_id) = $2
      ORDER BY pi.created_at`,
    [projectId, supplierOrg]
  );
  const items = it.rows.map((x) => ({
    id: x.id, name: x.name, description: x.description, install: x.install_description,
    price: Number(x.base_price ?? 0) || null,  // base_price = the item's "ballpark"
  }));

  const msgs = await pool.query(
    `SELECT from_org_id, body FROM messages
      WHERE project_id = $1 AND deleted_at IS NULL AND COALESCE(body, '') <> ''
        AND (from_org_id = $2 OR to_org_id = $2)
      ORDER BY created_at`,
    [projectId, supplierOrg]
  );
  const messages = msgs.rows.map((r) => ({ role: r.from_org_id === proj.agency_org ? 'agency' : 'supplier', body: r.body }));

  const s = await ai.extractSowTerms({
    messages, items,
    project: { eventDate: proj.event_date, guestCount: proj.guest_count },
  });
  const nameById = new Map(items.map((i) => [i.id, i.name]));
  return {
    milestones: s.milestones,
    payment: s.payment,
    depositPct: s.depositPct,
    items: s.items.map((x) => ({ ...x, itemName: nameById.get(x.itemId) || 'Item' })),
  };
}

/** Apply the suggestions the supplier ACCEPTED (possibly edited) from the suggest
 *  dialog: milestones/payment/deposit onto the SOW content, and per-item
 *  description/install/cost onto the live line (so the quote + SOW stay in sync).
 *  Draft-only; atomic. Variant proposals are folded into the item description for now. */
async function applySuggestions({ sowId, accepted }) {
  return withTransaction(async (client) => {
    const d = await client.query(
      `SELECT project_id, content, status FROM project_documents
        WHERE id = $1 AND type = 'sow' AND deleted_at IS NULL`,
      [sowId]
    );
    const doc = d.rows[0];
    if (!doc) throw httpErr('SOW not found', 404);
    if (doc.status !== 'draft') throw httpErr('The SOW must be a draft to apply changes', 400);

    const pr = await client.query(`SELECT event_date FROM projects WHERE id = $1`, [doc.project_id]);
    const eventDate = pr.rows[0]?.event_date ?? null;
    const content = doc.content && typeof doc.content === 'object' ? { ...doc.content } : {};

    const milestones = Array.isArray(accepted?.milestones) ? accepted.milestones : [];
    if (milestones.length) {
      const entries = milestones.map((m) => ({ date: eventDate, from: m.from ?? null, to: m.to ?? null, details: m.details ?? null }));
      content.timeline = { ...(content.timeline || {}), entries: [...((content.timeline || {}).entries || []), ...entries] };
    }
    const payment = Array.isArray(accepted?.payment) ? accepted.payment : [];
    if (payment.length) {
      content.payment = { rows: payment.map((p) => ({ date: null, grace: p.grace ?? null, amount: p.amount ?? null, refundable: p.refundable ?? 'na', details: p.details ?? null })) };
    }
    const depositPct = typeof accepted?.depositPct === 'number' ? accepted.depositPct : null;
    // Surface the deposit as a Payment Schedule ROW, not only the deposit_pct field —
    // the table renders rows, so an applied deposit was otherwise invisible
    // (Liam 2026-11-19). Idempotent: skip if a deposit row is already present.
    if (depositPct != null) {
      const rows = (content.payment && Array.isArray(content.payment.rows)) ? content.payment.rows : [];
      const hasDeposit = rows.some((r) => r && typeof r.details === 'string' && /deposit/i.test(r.details));
      if (!hasDeposit) {
        content.payment = { rows: [{ date: null, grace: null, amount: `${depositPct}%`, refundable: 'na', details: 'Deposit on order' }, ...rows] };
      }
    }
    await client.query(
      `UPDATE project_documents SET content = $2, deposit_pct = COALESCE($3, deposit_pct), updated_at = now() WHERE id = $1`,
      [sowId, content, depositPct]
    );

    for (const it of (Array.isArray(accepted?.items) ? accepted.items : [])) {
      if (!it || !it.itemId) continue;
      const sets = []; const vals = [it.itemId, doc.project_id];
      // variantChange / newVariant fold into the description (no structured variant edit yet).
      const desc = [it.description, it.variantChange, it.newVariant].filter((x) => typeof x === 'string' && x.trim()).join(' · ') || null;
      if (desc != null) { vals.push(desc); sets.push(`description = $${vals.length}`); }
      if (typeof it.install === 'string' && it.install.trim()) { vals.push(it.install.trim()); sets.push(`install_description = $${vals.length}`); }
      if (typeof it.cost === 'number') { vals.push(it.cost); sets.push(`base_price = $${vals.length}`); }  // the "ballpark"
      if (!sets.length) continue;
      await client.query(
        `UPDATE project_items SET ${sets.join(', ')}, updated_at = now() WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
        vals
      );
    }
    return { ok: true };
  });
}

/** Post a comment (either party). author_org/user pinned to the session by RLS. */
async function addComment({ sowId, anchorId, orgId, userId, body }) {
  try {
    const r = await pool.query(
      `INSERT INTO review_comments (entity_type, entity_id, anchor_id, author_org_id, author_user_id, body)
       VALUES ('sow', $1, $2, $3, $4, $5)
       RETURNING *`,
      [sowId, anchorId || null, orgId, userId, body]
    );
    return toCommentDto({ ...r.rows[0], viewer_org_id: orgId });
  } catch (e) {
    // RLS rejects a non-party (or a draft the counterparty can't yet see).
    if (/row-level security|violates row-level/i.test(e.message || '')) {
      throw httpErr('You cannot comment on this SOW', 403);
    }
    throw e;
  }
}

/** Resolve/close a comment — owner (author) side only (RLS enforces). */
async function resolveComment({ commentId, userId, viewerOrgId }) {
  const r = await pool.query(
    `UPDATE review_comments
        SET status = 'resolved', resolved_at = now(), resolved_by = $2
      WHERE id = $1 AND entity_type = 'sow' AND status = 'open'
      RETURNING *`,
    [commentId, userId]
  );
  if (!r.rows[0]) throw httpErr('Comment not found or not yours to resolve', 404);
  return toCommentDto({ ...r.rows[0], viewer_org_id: viewerOrgId });
}

/** Edit a comment's body — author side only, while open (RLS enforces). */
async function editComment({ commentId, body, viewerOrgId }) {
  const r = await pool.query(
    `UPDATE review_comments
        SET body = $2
      WHERE id = $1 AND entity_type = 'sow' AND status = 'open'
      RETURNING *`,
    [commentId, body]
  );
  if (!r.rows[0]) throw httpErr('Comment not found or not yours to edit', 404);
  return toCommentDto({ ...r.rows[0], viewer_org_id: viewerOrgId });
}

/** Delete a comment — author side only (RLS enforces). */
async function deleteComment({ commentId }) {
  const r = await pool.query(
    `DELETE FROM review_comments
      WHERE id = $1 AND entity_type = 'sow'
      RETURNING id`,
    [commentId]
  );
  if (!r.rows[0]) throw httpErr('Comment not found or not yours to delete', 404);
  return { id: r.rows[0].id };
}

// ── prefill the author's SOW from the project + the supplier's engagement items ─
// Read server-side as the caller (own-org): project details for "Project Details",
// and the supplier's quoted items (+ their catalogue install_description) for
// "Scope" and "Included Services". The client turns this into the structured
// content the supplier edits; it is NOT stored until they save, so no cross-org
// snapshot is involved (the authored content is what the counterparty later reads).
async function prefill({ orgId, orgType, projectId }) {
  const pr = await pool.query(
    `SELECT name, venue_name, event_date, duration_days, guest_count
       FROM projects WHERE id = $1 AND deleted_at IS NULL`,
    [projectId]
  );
  const p = pr.rows[0] || null;

  let items = [];
  const supplierParty = orgType === 'supplier' ? orgId : null;
  if (supplierParty) {
    const pp = await pool.query(
      `SELECT id FROM project_providers
        WHERE project_id = $1 AND provider_org_id = $2 AND deleted_at IS NULL`,
      [projectId, supplierParty]
    );
    if (pp.rows[0]) {
      const r = await pool.query(
        `SELECT pi.id,
                COALESCE(q.name, pi.name)              AS name,
                COALESCE(q.description, pi.description) AS description,
                i.install_description,
                COALESCE(q.price_current, pi.base_price) AS price
           FROM project_item_quotes q
           JOIN project_items pi ON pi.id = q.project_item_id AND pi.deleted_at IS NULL
           LEFT JOIN items i ON i.id = pi.item_id
          WHERE q.project_provider_id = $1 AND q.deleted_at IS NULL
          ORDER BY pi.created_at`,
        [pp.rows[0].id]
      );
      items = r.rows.map((x) => ({
        id: x.id,
        name: x.name,
        description: x.description,
        installDescription: x.install_description,
        price: x.price != null ? Number(x.price) : null,
      }));
    }
  }

  // NB: conversation extraction (ai.extractSowTerms) is NOT run here — it belongs to
  // the on-demand suggestion dialog (per-item accept/decline), so prefill stays cheap
  // and nothing is proposed implicitly.
  return {
    project: p
      ? { name: p.name, venueName: p.venue_name, eventDate: p.event_date, durationDays: p.duration_days, guestCount: p.guest_count }
      : null,
    items,
  };
}

// Both parties' legal details for the SOW Parties block (cross-org via the gated
// sow_parties definer — only an engagement party gets the data).
async function parties({ id }) {
  const d = await pool.query('SELECT project_provider_id FROM project_documents WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (!d.rows[0]) throw httpErr('SOW not found', 404);
  const out = { agency: null, supplier: null };
  if (!d.rows[0].project_provider_id) return out;
  const r = await pool.query('SELECT * FROM public.sow_parties($1)', [d.rows[0].project_provider_id]);
  for (const row of r.rows) {
    out[row.role] = {
      orgId: row.org_id,
      name: row.name,
      companyNumber: row.company_number,
      vatNumber: row.vat_number,
      jurisdiction: row.country,
      address: [row.line1, row.line2, row.city, row.region, row.postcode, row.country].filter(Boolean).join(', ') || null,
    };
  }
  return out;
}

module.exports = { createDraft, listForProject, getById, updateDraft, review, prefill, parties, listComments, addComment, resolveComment, editComment, deleteComment, history, suggest, applySuggestions, PLATFORM_FEE_PCT };
