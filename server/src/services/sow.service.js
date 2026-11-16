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

const PLATFORM_FEE_PCT = 3; // Ballpark platform fee, shown on every SOW (pV2-SOW-01).

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
    content: row.content ?? [],
    presentation: row.presentation ?? {},
    depositPct: row.deposit_pct != null ? Number(row.deposit_pct) : null,
    projectId: row.project_id,
    projectProviderId: row.project_provider_id,
    orgId: row.org_id, // the author
    supplierOrgId: row.supplier_org_id, // the supplier party (denormalised)
    supersedesDocumentId: row.supersedes_document_id || null,
    issuedAt: row.issued_at || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── cross-org party display (names only — org_contact/supplier_directory expose
//    name/logo/city, which is enough for the SOW parties header; full legal
//    address cross-org is a later widening, flagged in the ship notes) ─────────
async function resolveParties(viewer, agencyOrgId, supplierOrgId) {
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
async function createDraft({ orgId, userId, projectProviderId, name, content, depositPct }) {
  // Resolve the engagement under RLS — the caller must be a party to see it.
  const pp = await pool.query(
    `SELECT id, project_id, org_id, provider_org_id FROM project_providers
      WHERE id = $1 AND deleted_at IS NULL`,
    [projectProviderId]
  );
  if (!pp.rows[0]) throw httpErr('Engagement not found', 404);
  const eng = pp.rows[0];
  if (orgId !== eng.org_id && orgId !== eng.provider_org_id) {
    throw httpErr('Not a party to this engagement', 403);
  }
  const r = await pool.query(
    `INSERT INTO project_documents
       (org_id, project_id, project_provider_id, supplier_org_id, name, type, status, content, deposit_pct, created_by, updated_by)
     VALUES ($1,$2,$3,$4,$5,'sow','draft',$6::jsonb,$7,$8,$8)
     RETURNING *`,
    [orgId, eng.project_id, eng.id, eng.provider_org_id, name, JSON.stringify(content ?? []), depositPct ?? null, userId ?? null]
  );
  return toSowDto(r.rows[0]);
}

// ── list the SOWs on a project visible to the caller ─────────────────────────
// No org_id filter — RLS (author _all + counterparty_read) defines the visible
// set, so the caller sees both the SOWs it authored AND the counterparty-authored
// ones on its engagements. Filtering org_id=:me here would drop the latter.
async function listForProject(projectId) {
  const r = await pool.query(
    `SELECT * FROM project_documents
      WHERE project_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC`,
    [projectId]
  );
  return r.rows.map(toSowDto);
}

// ── one SOW, as a render payload (doc + parties + signatures + the fee line) ──
async function getById(id, viewerOrgType) {
  const r = await pool.query('SELECT * FROM project_documents WHERE id = $1 AND deleted_at IS NULL', [id]);
  if (!r.rows[0]) throw httpErr('SOW not found', 404); // RLS-filtered → not visible
  const row = r.rows[0];
  // Parties: agency = the engagement's org side; supplier = the provider side
  // (supplier_org_id is denormalised to it). Resolve both names.
  const pp = await pool.query('SELECT org_id FROM project_providers WHERE id = $1', [row.project_provider_id]);
  const agencyOrgId = pp.rows[0] ? pp.rows[0].org_id : null;
  const [parties, signatures] = await Promise.all([
    resolveParties(viewerOrgType, agencyOrgId, row.supplier_org_id),
    signaturesFor(id),
  ]);
  return { ...toSowDto(row), parties, signatures, platformFeePct: PLATFORM_FEE_PCT };
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
    // The freeze trigger raises once a signature exists — a signed SOW is immutable.
    if (/frozen once signed/i.test(e.message || '')) throw httpErr('SOW is signed and can no longer be edited — create a new SOW to amend', 409);
    throw e;
  }
}

// ── sign (counterparty first → counterparty_signed; author last → executed) ──
// The caller's org_type IS the party role (agency|supplier); document_sign
// re-derives the party from the session + engagement and rejects a mismatch.
async function sign({ id, orgType, name, title }) {
  try {
    const r = await pool.query('SELECT * FROM public.document_sign($1,$2,$3,$4)', [id, orgType, name, title]);
    return toSowDto(r.rows[0]);
  } catch (e) {
    const msg = e.message || '';
    if (/not a party|does not match the signing party|owner is not a party/i.test(msg)) throw httpErr('You are not a party to this SOW', 403);
    if (/counterparty signs the unsigned draft|author counter-signs only after|document not found|not supported/i.test(msg)) {
      throw httpErr(msg, 409);
    }
    throw e;
  }
}

module.exports = { createDraft, listForProject, getById, updateDraft, sign, PLATFORM_FEE_PCT };
