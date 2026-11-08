// pV2-INVITE-SUPPLIER-01 — an agency invites a supplier who isn't on Ballpark.
//
// The supplier becomes a REAL pending org (orgs type='supplier' status='pending')
// with an invited OWNER seat, ONE per supplier shared across agencies; the agency
// is linked by an org_invites row (0034). Lines route to it through the existing
// project_items.requested_provider_org_id (0033); send is held until it joins.
//
// SECURITY. Dedupe (email → existing org) is a CROSS-AGENCY read — another
// agency's pending org/seat is invisible under own-org RLS, so it runs on the
// bootstrap pool (withBootstrapTransaction). Run it through the RLS pool and it
// would silently miss and mint duplicate pending orgs (the supplier_directory
// bite). Writes (orgs / users stub / user_orgs / org_invites) are the same
// bootstrap path as onboarding create-org; audit columns carry the inviter.
//
// PRIVACY. A reuse (another agency already invited them) is SILENT and the
// response is shaped identically to a fresh invite, so the endpoint can't be
// used as an "is this email already invited?" oracle. The only 409 is for an
// ACTIVE supplier, which is public in the marketplace anyway.

const pool = require('../db/pool');
const { withBootstrapTransaction } = require('../db/with-transaction');
const { sendEmail } = require('./email.service');
const { maskEmail } = require('../lib/mask-email');

const BALLPARK_ORG_ID = '00000000-0000-0000-0000-000000000001';

function httpErr(message, status, extra) {
  const e = new Error(message);
  e.status = status;
  if (extra) Object.assign(e, extra);
  return e;
}

/** Bare host of a website ("https://www.Acme.co.uk/x" → "acme.co.uk"), or null. */
function websiteHost(url) {
  if (!url) return null;
  const m = String(url).trim().toLowerCase().match(/^(?:[a-z][a-z0-9+.-]*:\/\/)?(?:www\.)?([^/:?#\s]+)/);
  return m && m[1] && m[1].includes('.') ? m[1] : null;
}

// SQL twin of websiteHost() for the dedupe lookup.
const HOST_SQL = `lower(substring(o.website from '^(?:[A-Za-z][A-Za-z0-9+.-]*://)?(?:[Ww][Ww][Ww]\\.)?([^/:?#[:space:]]+)'))`;

/**
 * Invite (or silently reuse) a pending supplier for the caller's agency.
 * Returns { supplier: { id, name, status }, categoryId }.
 * Throws 409 { existingSupplier: { id, name } } for an ACTIVE supplier match.
 */
async function inviteSupplier({ agencyOrgId, userId, projectId, businessName, contactName, email, website, categoryId }) {
  const cleanEmail = email.trim().toLowerCase();
  const host = websiteHost(website);

  // Ownership + category check on the RLS pool (the agency's own rows).
  const proj = await pool.query(
    `SELECT p.id, p.name, o.name AS agency_name
       FROM projects p JOIN orgs o ON o.id = p.org_id
      WHERE p.id = $1 AND p.org_id = $2 AND p.deleted_at IS NULL`,
    [projectId, agencyOrgId]
  );
  if (!proj.rows.length) return null;
  const pc = await pool.query(
    `SELECT id FROM project_categories WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL`,
    [categoryId, projectId]
  );
  if (!pc.rows.length) throw httpErr('Pick one of this project\'s categories', 400);

  const result = await withBootstrapTransaction(async (db) => {
    // ── 1. Dedupe ─────────────────────────────────────────────────────────
    // (a) the email's user already holds a seat on a supplier org.
    const seat = await db.query(
      `SELECT o.id, o.name, o.status, uo.status AS seat_status, uo.role
         FROM users u
         JOIN user_orgs uo ON uo.user_id = u.id AND uo.deleted_at IS NULL
         JOIN orgs o ON o.id = uo.org_id AND o.deleted_at IS NULL AND o.type = 'supplier'
        WHERE lower(u.email) = $1 AND u.deleted_at IS NULL
        ORDER BY (o.status = 'active') DESC, uo.created_at ASC`,
      [cleanEmail]
    );
    const activeSeat = seat.rows.find((r) => r.status === 'active' && r.seat_status === 'active');
    if (activeSeat) throw httpErr('Already on Ballpark', 409, { existingSupplier: { id: activeSeat.id, name: activeSeat.name } });
    let supplier = seat.rows.find((r) => r.status === 'pending' && r.seat_status === 'invited') || null;

    // (b) an ACTIVE supplier on the same website host, (c) the same name.
    if (!supplier) {
      const byHostOrName = await db.query(
        `SELECT o.id, o.name, o.status, o.type FROM orgs o
          WHERE o.deleted_at IS NULL
            AND (lower(o.name) = lower($1)
                 OR ($2::text IS NOT NULL AND o.type = 'supplier' AND o.status = 'active' AND ${HOST_SQL} = $2))
          ORDER BY (o.status = 'active') DESC`,
        [businessName, host]
      );
      const active = byHostOrName.rows.find((r) => r.type === 'supplier' && r.status === 'active');
      if (active) throw httpErr('Already on Ballpark', 409, { existingSupplier: { id: active.id, name: active.name } });
      const sameName = byHostOrName.rows.find((r) => r.name.toLowerCase() === businessName.toLowerCase());
      if (sameName && sameName.type === 'supplier' && sameName.status === 'pending') {
        supplier = sameName; // the same business already invited — reuse silently
      } else if (sameName) {
        // orgs.name is globally unique; an agency/suspended org already has it.
        throw httpErr('That business name is already in use on Ballpark — add a location or trading name', 409);
      }
    }

    // ── 2. Create the pending org + invited owner seat ─────────────────────
    let created = false;
    if (!supplier) {
      let u = await db.query(`SELECT id FROM users WHERE lower(email) = $1 AND deleted_at IS NULL`, [cleanEmail]);
      let inviteeId;
      if (u.rows.length) {
        inviteeId = u.rows[0].id;
      } else {
        const name = (contactName || '').trim() || cleanEmail;
        u = await db.query(
          `INSERT INTO users (name, display_name, email, org_id, created_by, updated_by)
           VALUES ($1, $2, $3, $4, $5, $5) RETURNING id`,
          [name, (contactName || '').trim() || null, cleanEmail, BALLPARK_ORG_ID, userId]
        );
        inviteeId = u.rows[0].id;
      }
      const org = await db.query(
        `INSERT INTO orgs (name, type, status, website, parent_id, created_by, updated_by)
         VALUES ($1, 'supplier', 'pending', $2, $3, $4, $4) RETURNING id, name, status`,
        [businessName, website || null, BALLPARK_ORG_ID, userId]
      );
      supplier = org.rows[0];
      await db.query(
        `INSERT INTO user_orgs (user_id, org_id, role, status, invited_by_user_id, invited_at, created_by)
         VALUES ($1, $2, 'owner', 'invited', $3, NOW(), $3)`,
        [inviteeId, supplier.id, userId]
      );
      created = true;
    }

    // ── 3. Link the inviting agency (one row per agency × supplier) ────────
    const link = await db.query(
      `INSERT INTO org_invites (supplier_org_id, agency_org_id, project_id, invited_by_user_id, created_by, updated_by)
       VALUES ($1, $2, $3, $4, $4, $4)
       ON CONFLICT (supplier_org_id, agency_org_id) WHERE deleted_at IS NULL DO NOTHING
       RETURNING id`,
      [supplier.id, agencyOrgId, projectId, userId]
    );
    const newLink = link.rows.length > 0;

    // The address the invite goes to = the pending org's invited owner seat.
    const to = await db.query(
      `SELECT u.email FROM user_orgs uo JOIN users u ON u.id = uo.user_id
        WHERE uo.org_id = $1 AND uo.role = 'owner' AND uo.status = 'invited' AND uo.deleted_at IS NULL
        ORDER BY uo.created_at ASC LIMIT 1`,
      [supplier.id]
    );
    return { supplier, created, newLink, inviteEmail: to.rows[0]?.email ?? null };
  });

  console.log(`[supplier-invite] agency=${agencyOrgId} supplier=${result.supplier.id} ` +
    `${result.created ? 'created' : 'reused'} link=${result.newLink ? 'new' : 'existing'} to=${maskEmail(result.inviteEmail)}`);

  // ── 4. Invite email — only when THIS agency's link is new (no re-spam) ────
  if (result.newLink && result.inviteEmail) {
    sendInviteEmail({
      to: result.inviteEmail,
      agencyName: proj.rows[0].agency_name,
      businessName: result.supplier.name,
    });
  }

  // Identical shape for fresh vs reused (no enumeration oracle).
  return {
    supplier: { id: result.supplier.id, name: result.supplier.name, status: 'pending' },
    categoryId,
  };
}

const APP_URL = () => process.env.WEB_BASE_URL || process.env.PUBLIC_APP_URL || 'http://localhost:4201';

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/** Fire-and-forget, gated by SUPPLIER_INVITE_EMAILS_ENABLED (mirrors QUOTE_REQUEST_EMAILS_ENABLED). */
function sendInviteEmail({ to, agencyName, businessName }) {
  if (process.env.SUPPLIER_INVITE_EMAILS_ENABLED !== 'true') return;
  const link = `${APP_URL()}/`;
  const subject = `${agencyName} invited you to quote on Ballpark`;
  const text = `${agencyName} would like ${businessName} to quote for an event on Ballpark.\n\n` +
    `Sign in with this email address to accept: ${link}\n`;
  const html = `<p>${escHtml(agencyName)} would like <strong>${escHtml(businessName)}</strong> to quote for an event on Ballpark.</p>` +
    `<p><a href="${escHtml(link)}">Sign in with this email address</a> to accept the invite.</p>`;
  sendEmail({ to, subject, text, html }).catch((e) =>
    console.error('[supplier-invite] invite email failed', maskEmail(to), e.message));
}

/** Fire-and-forget "they joined" to one inviting user; same flag. */
function sendJoinedEmail({ to, businessName }) {
  if (process.env.SUPPLIER_INVITE_EMAILS_ENABLED !== 'true') return;
  const subject = `${businessName} has joined Ballpark`;
  const text = `${businessName} accepted your invite. You can now send them your lines from the estimate: ${APP_URL()}/\n`;
  const html = `<p><strong>${escHtml(businessName)}</strong> accepted your invite.</p>` +
    `<p>You can now <a href="${escHtml(APP_URL())}/">send them your lines</a> from the estimate.</p>`;
  sendEmail({ to, subject, text, html }).catch((e) =>
    console.error('[supplier-invite] joined email failed', maskEmail(to), e.message));
}

/**
 * The caller's outstanding supplier invites (accept screen). Keyed on the JWT
 * user id only. Bootstrap read: an invited (not yet active) user has no current
 * org, so own-org RLS can't see the pending org or the inviting agencies.
 */
async function listMyInvites(userId) {
  return withBootstrapTransaction(async (db) => {
    const r = await db.query(
      `SELECT o.id AS supplier_org_id, o.name AS business_name,
              COALESCE(array_agg(DISTINCT a.name) FILTER (WHERE a.name IS NOT NULL), '{}') AS agencies
         FROM user_orgs uo
         JOIN orgs o ON o.id = uo.org_id AND o.type = 'supplier' AND o.status = 'pending' AND o.deleted_at IS NULL
         LEFT JOIN org_invites oi ON oi.supplier_org_id = o.id AND oi.deleted_at IS NULL
         LEFT JOIN orgs a ON a.id = oi.agency_org_id
        WHERE uo.user_id = $1 AND uo.status = 'invited' AND uo.deleted_at IS NULL
        GROUP BY o.id, o.name
        ORDER BY o.name`,
      [userId]
    );
    return r.rows.map((x) => ({ supplierOrgId: x.supplier_org_id, businessName: x.business_name, agencies: x.agencies }));
  });
}

/**
 * Accept: the invited user (seat 'invited' on a pending supplier org) flips the
 * seat + org to active, stamps accepted_at on EVERY org_invites row for the org
 * (fan-out — several agencies may have invited them) and emails every inviter.
 * Returns the org id, or null when the caller holds no such invite.
 */
async function acceptInvite(userId, supplierOrgId) {
  const res = await withBootstrapTransaction(async (db) => {
    const seat = await db.query(
      `SELECT o.name FROM user_orgs uo
         JOIN orgs o ON o.id = uo.org_id AND o.type = 'supplier' AND o.status = 'pending' AND o.deleted_at IS NULL
        WHERE uo.user_id = $1 AND uo.org_id = $2 AND uo.status = 'invited' AND uo.deleted_at IS NULL
        FOR UPDATE OF uo`,
      [userId, supplierOrgId]
    );
    if (!seat.rows.length) return null;
    await db.query(
      `UPDATE user_orgs SET status = 'active', joined_at = NOW(), updated_at = NOW(), updated_by = $1
        WHERE user_id = $1 AND org_id = $2`,
      [userId, supplierOrgId]
    );
    // orgs UPDATE has NO admin escape (FR-00215, 0013: member-only), so the
    // bootstrap flag doesn't cover it — and it shouldn't. The caller is now this
    // org's ACTIVE OWNER (seat flipped above), so act AS that org for the update:
    // the ordinary own-org policy then allows it. RETURNING proves it landed (RLS
    // would otherwise filter silently to 0 rows).
    await db.query(`SELECT set_config('app.current_org_id', $1, true)`, [supplierOrgId]);
    const flipped = await db.query(
      `UPDATE orgs SET status = 'active', updated_at = NOW(), updated_by = $1 WHERE id = $2 RETURNING id`,
      [userId, supplierOrgId]
    );
    if (!flipped.rows.length) throw new Error('accept: org status update was filtered');
    const inviters = await db.query(
      `UPDATE org_invites oi SET accepted_at = NOW(), updated_at = NOW(), updated_by = $1
         FROM users u
        WHERE oi.supplier_org_id = $2 AND oi.deleted_at IS NULL AND oi.accepted_at IS NULL
          AND u.id = oi.invited_by_user_id AND u.deleted_at IS NULL
        RETURNING oi.agency_org_id, u.email`,
      [userId, supplierOrgId]
    );
    await db.query(
      `UPDATE users SET default_org_id = COALESCE(default_org_id, $2), updated_at = NOW() WHERE id = $1`,
      [userId, supplierOrgId]
    );
    return { businessName: seat.rows[0].name, inviters: inviters.rows };
  });
  if (!res) return null;
  console.log(`[supplier-invite] accepted supplier=${supplierOrgId} notified=${res.inviters.length}`);
  for (const inv of res.inviters) sendJoinedEmail({ to: inv.email, businessName: res.businessName });
  return { supplierOrgId };
}

module.exports = { inviteSupplier, listMyInvites, acceptInvite, websiteHost };
