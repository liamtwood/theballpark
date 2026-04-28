/**
 * Marketing service — public welcome page + guestlist signups.
 *
 * The marketing schema is cross-environment (single instance), so all
 * queries explicitly prefix `marketing.*` rather than relying on the
 * env-driven search_path.
 */

const pool = require('../db/pool');
const { sendEmail } = require('./email.service');

const ALLOWED_ROLES = [
  'Agency producer',
  'Freelance producer',
  'Supplier',
  'Brand / in-house',
  'Just curious'
];

// ── Content ───────────────────────────────────────────────────────────

// Returns content as a single object keyed by `key`. List values are
// returned as arrays. Sorted by slide / display_order under the hood.
async function getPublicContent() {
  const { rows } = await pool.query(
    `SELECT key, value, field_type
       FROM marketing.welcome_content
      ORDER BY slide, display_order`
  );
  const out = {};
  for (const r of rows) {
    out[r.key] = r.field_type === 'list'
      ? r.value.split(',').map(s => s.trim()).filter(Boolean)
      : r.value;
  }
  return out;
}

// Admin: full rows with metadata
async function getContentForAdmin() {
  const { rows } = await pool.query(
    `SELECT key, value, field_type, label, help_text, slide, display_order, updated_at, updated_by
       FROM marketing.welcome_content
      ORDER BY slide, display_order`
  );
  return rows;
}

// Admin: bulk patch — accepts [{ key, value }, ...]
async function patchContent(updates, adminUserId) {
  if (!Array.isArray(updates) || !updates.length) return 0;
  let count = 0;
  for (const u of updates) {
    if (!u.key || u.value == null) continue;
    const { rowCount } = await pool.query(
      `UPDATE marketing.welcome_content
          SET value = $1, updated_at = NOW(), updated_by = $2
        WHERE key = $3`,
      [String(u.value), adminUserId || null, u.key]
    );
    count += rowCount;
  }
  return count;
}

// ── Settings ──────────────────────────────────────────────────────────

async function getSettings() {
  const { rows } = await pool.query(
    `SELECT id, notify_recipients, email_subject, email_body_template, updated_at, updated_by
       FROM marketing.welcome_settings WHERE id = 1`
  );
  return rows[0] || null;
}

async function updateSettings({ notify_recipients, email_subject, email_body_template }, adminUserId) {
  const { rows } = await pool.query(
    `UPDATE marketing.welcome_settings
        SET notify_recipients   = COALESCE($1, notify_recipients),
            email_subject       = COALESCE($2, email_subject),
            email_body_template = COALESCE($3, email_body_template),
            updated_at          = NOW(),
            updated_by          = $4
      WHERE id = 1
      RETURNING *`,
    [notify_recipients || null, email_subject || null, email_body_template || null, adminUserId || null]
  );
  return rows[0];
}

// ── Signups ───────────────────────────────────────────────────────────

function isValidEmail(s) {
  return typeof s === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s) && s.length <= 320;
}

function validateSignupInput(body) {
  const name    = (body?.name    || '').trim();
  const email   = (body?.email   || '').trim().toLowerCase();
  const company = (body?.company || '').trim() || null;
  const role    = (body?.role    || '').trim();

  if (name.length < 1 || name.length > 100) return 'Name must be 1–100 characters';
  if (!isValidEmail(email))                   return 'Invalid email address';
  if (company && company.length > 200)        return 'Company must be ≤ 200 characters';
  if (!ALLOWED_ROLES.includes(role))          return 'Invalid role';
  return null;
}

function renderTemplate(tpl, vars) {
  return String(tpl).replace(/\{\{(\w+)\}\}/g, (_, k) => (vars[k] ?? ''));
}

function formatTimestamp(d) {
  // "27 Apr 2026, 14:32 BST" — in the registrant's UTC offset, but labelled
  // as London for readability (we expect Beth/Megan in UK).
  const opts = {
    timeZone:  'Europe/London',
    day:       'numeric',
    month:     'short',
    year:      'numeric',
    hour:      '2-digit',
    minute:    '2-digit',
    hour12:    false
  };
  const fmt = new Intl.DateTimeFormat('en-GB', opts).format(d);
  // Fallback labelling — Intl includes the date but not the zone abbrev.
  return `${fmt} BST`;
}

async function createSignup({ body, ip, userAgent }) {
  const errMsg = validateSignupInput(body);
  if (errMsg) return { ok: false, status: 400, error: errMsg };

  const name    = body.name.trim();
  const email   = body.email.trim().toLowerCase();
  const company = (body.company || '').trim() || null;
  const role    = body.role.trim();

  let signup;
  try {
    const { rows } = await pool.query(
      `INSERT INTO marketing.guestlist_signup (name, email, company, role, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, email, company, role, ip || null, userAgent || null]
    );
    signup = rows[0];
  } catch (err) {
    if (err.code === '23505') {
      // Unique violation — already signed up. Return success without re-sending email.
      return { ok: true, body: { success: true, alreadyRegistered: true } };
    }
    throw err;
  }

  // Send notification email (best-effort — failure does not roll back the signup)
  try {
    const settings = await getSettings();
    if (settings?.notify_recipients?.length) {
      const vars = {
        name,
        email,
        company:    company || '—',
        role,
        created_at: formatTimestamp(new Date(signup.created_at)),
        admin_url:  process.env.ADMIN_BASE_URL
                      ? `${process.env.ADMIN_BASE_URL}/ballpark-settings/early-access`
                      : 'https://theballpark.ai/ballpark-settings/early-access',
        firstName:  name.split(' ')[0] || name
      };
      const subject = renderTemplate(settings.email_subject, vars);
      const text    = renderTemplate(settings.email_body_template, vars);
      await sendEmail({ to: settings.notify_recipients, subject, text });
      await pool.query(
        `UPDATE marketing.guestlist_signup SET notified_at = NOW() WHERE id = $1`,
        [signup.id]
      );
    }
  } catch (emailErr) {
    console.error('[marketing] Email notification failed:', emailErr.message);
    // notified_at stays null for retry — signup is already recorded
  }

  return { ok: true, body: { success: true } };
}

// Admin: paginated list of signups with search + role filter + sort
async function listSignups({ q, roles, sort, limit = 100, offset = 0 }) {
  const params = [];
  const where  = [];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(LOWER(name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length} OR LOWER(COALESCE(company, '')) LIKE $${params.length})`);
  }
  if (Array.isArray(roles) && roles.length) {
    params.push(roles);
    where.push(`role = ANY($${params.length})`);
  }
  const order = sort === 'oldest' ? 'ASC' : 'DESC';
  const sql = `
    SELECT id, name, email, company, role, created_at, notified_at
      FROM marketing.guestlist_signup
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at ${order}
     LIMIT ${Number(limit) || 100}
     OFFSET ${Number(offset) || 0}
  `;
  const { rows } = await pool.query(sql, params);

  const stats = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('day',  NOW()))::int AS today,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW()))::int AS this_week
     FROM marketing.guestlist_signup`
  );
  const byRole = await pool.query(
    `SELECT role, COUNT(*)::int AS count
       FROM marketing.guestlist_signup
      GROUP BY role`
  );

  return {
    rows,
    stats: {
      total:     stats.rows[0].total,
      today:     stats.rows[0].today,
      this_week: stats.rows[0].this_week,
      by_role:   Object.fromEntries(byRole.rows.map(r => [r.role, r.count]))
    }
  };
}

async function sendTestEmail({ recipients, subject, body_template }) {
  if (!Array.isArray(recipients) || !recipients.length) {
    throw new Error('At least one recipient required');
  }
  const sample = {
    name:       'Jane Doe',
    email:      'jane@studio.com',
    company:    'Studio Example',
    role:       'Agency producer',
    created_at: formatTimestamp(new Date()),
    admin_url:  process.env.ADMIN_BASE_URL
                  ? `${process.env.ADMIN_BASE_URL}/ballpark-settings/early-access`
                  : 'https://theballpark.ai/ballpark-settings/early-access',
    firstName:  'Jane'
  };
  const finalSubject = '[TEST] ' + renderTemplate(subject || '', sample);
  const finalText    = renderTemplate(body_template || '', sample) +
                       '\n\n— This is a test email sent from the Ballpark admin Settings tab.';
  return sendEmail({ to: recipients, subject: finalSubject, text: finalText });
}

module.exports = {
  ALLOWED_ROLES,
  getPublicContent,
  getContentForAdmin,
  patchContent,
  getSettings,
  updateSettings,
  createSignup,
  listSignups,
  sendTestEmail
};
