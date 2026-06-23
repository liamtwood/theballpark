/**
 * Marketing service — public welcome page + guestlist signups.
 *
 * The marketing schema is cross-environment (single instance), so all
 * queries explicitly prefix `marketing.*` rather than relying on the
 * env-driven search_path.
 */

const pool = require('../db/pool');
const { sendEmail } = require('./email.service');

/** pV2-EA-01 — tag each signup with the environment it came from (the
 *  marketing schema is single-instance across dev/preview/master). Inferred
 *  from the Origin header per docs/BALLPARK_ADMIN.md — spoofable, but
 *  low-stakes (analytics tagging, not security). */
function inferEnvironment(origin) {
  if (!origin) return 'unknown';
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) return 'dev';
  if (origin.includes('preview.')) return 'preview';
  if (origin.includes('theballpark.ai')) return 'master';
  return 'unknown';
}

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

/**
 * v1.65gZ29 — Cloudflare Turnstile verification.
 *
 * Posts the user-supplied token to the Cloudflare siteverify
 * endpoint along with the server's secret. Returns { ok, reason }.
 *
 * Graceful fallback: if TURNSTILE_SECRET_KEY isn't configured in
 * the env (local dev, or before the secret is added to Railway),
 * verification is SKIPPED with a one-time warning. Production with
 * the secret set = enforced.
 */
async function verifyTurnstile(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (!verifyTurnstile._warned) {
      console.warn('[turnstile] TURNSTILE_SECRET_KEY not set — bot-check skipped (dev mode).');
      verifyTurnstile._warned = true;
    }
    return { ok: true, skipped: true };
  }
  if (!token || typeof token !== 'string') {
    return { ok: false, reason: 'missing-token' };
  }
  try {
    const params = new URLSearchParams();
    params.append('secret', secret);
    params.append('response', token);
    if (remoteIp) params.append('remoteip', String(remoteIp));

    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body: params
    });
    const data = await res.json();
    if (data && data.success) return { ok: true };
    return { ok: false, reason: 'cf-rejected', codes: data?.['error-codes'] || [] };
  } catch (err) {
    console.error('[turnstile] siteverify call failed:', err.message);
    // Fail closed — if we can't verify, don't accept the signup.
    return { ok: false, reason: 'siteverify-unreachable' };
  }
}

function validateSignupInput(body) {
  // pV2-EA-01 — first/last name captured separately (the welcome form sends
  // them as distinct fields); role + company dropped.
  const firstName = (body?.first_name || '').trim();
  const lastName  = (body?.last_name  || '').trim();
  const email     = (body?.email      || '').trim().toLowerCase();

  if (firstName.length < 1 || firstName.length > 100) return 'First name must be 1–100 characters';
  if (lastName.length  < 1 || lastName.length  > 100) return 'Last name must be 1–100 characters';
  if (!isValidEmail(email))                            return 'Invalid email address';
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

async function createSignup({ body, ip, userAgent, origin }) {
  const errMsg = validateSignupInput(body);
  if (errMsg) return { ok: false, status: 400, error: errMsg };

  // v1.65gZ29 — Turnstile bot-check. Run BEFORE the INSERT (and
  // before the unique-violation catch) so attackers can't probe
  // which emails already exist by spamming the form.
  const ts = await verifyTurnstile(body.turnstileToken, ip);
  if (!ts.ok) {
    return { ok: false, status: 400, error: 'Bot check failed. Please try again.' };
  }

  const firstName   = body.first_name.trim();
  const lastName    = body.last_name.trim();
  const email       = body.email.trim().toLowerCase();
  const sourceEnv   = inferEnvironment(origin);

  let signup;
  try {
    const { rows } = await pool.query(
      `INSERT INTO marketing.guestlist_signup
         (first_name, last_name, email, source_environment, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [firstName, lastName, email, sourceEnv, ip || null, userAgent || null]
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
        // {{name}} kept (full name) for templates that reference it; {{firstName}}
        // now reads the first_name column directly (no space-split — EA-01 §4).
        name:       `${firstName} ${lastName}`.trim(),
        firstName,
        email,
        created_at: formatTimestamp(new Date(signup.created_at)),
        admin_url:  process.env.ADMIN_BASE_URL
                      ? `${process.env.ADMIN_BASE_URL}/ballpark-settings/early-access`
                      : 'https://theballpark.ai/ballpark-settings/early-access'
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

// Admin: paginated list of signups with search + role filter + sort.
// v1.65gZ32 — only returns rows where deleted_at IS NULL. Soft-deleted
// rows stay in the table for audit but are hidden from this listing.
async function listSignups({ q, envs, sort, limit = 100, offset = 0 }) {
  // pV2-EA-01 — first/last name + source_environment; role + company gone.
  // pV2-EA-02 — environment filter + env-breakdown stats for the admin UI.
  const params = [];
  const where  = ['deleted_at IS NULL'];
  if (q) {
    params.push(`%${q.toLowerCase()}%`);
    where.push(`(LOWER(first_name) LIKE $${params.length} OR LOWER(last_name) LIKE $${params.length} OR LOWER(email) LIKE $${params.length})`);
  }
  if (Array.isArray(envs) && envs.length) {
    params.push(envs);
    where.push(`source_environment = ANY($${params.length})`);
  }
  const order = sort === 'oldest' ? 'ASC' : 'DESC';
  // LIMIT/OFFSET bound as params (defence-in-depth — they were Number()-coerced
  // and not injectable, but no concatenated values reach the SQL string now).
  params.push(Number(limit) || 100);
  const limParam = `$${params.length}`;
  params.push(Number(offset) || 0);
  const offParam = `$${params.length}`;
  const sql = `
    SELECT id, first_name, last_name, email, source_environment, created_at, notified_at
      FROM marketing.guestlist_signup
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
     ORDER BY created_at ${order}
     LIMIT ${limParam}
     OFFSET ${offParam}
  `;
  const { rows } = await pool.query(sql, params);

  const stats = await pool.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('day',  NOW()))::int AS today,
       COUNT(*) FILTER (WHERE created_at >= date_trunc('week', NOW()))::int AS this_week
     FROM marketing.guestlist_signup
    WHERE deleted_at IS NULL`
  );
  const byEnv = await pool.query(
    `SELECT source_environment, COUNT(*)::int AS count
       FROM marketing.guestlist_signup
      WHERE deleted_at IS NULL
      GROUP BY source_environment`
  );

  return {
    rows,
    stats: {
      total:     stats.rows[0].total,
      today:     stats.rows[0].today,
      this_week: stats.rows[0].this_week,
      by_environment: Object.fromEntries(byEnv.rows.map(r => [r.source_environment, r.count]))
    }
  };
}

async function sendTestEmail({ recipients, subject, body_template }) {
  if (!Array.isArray(recipients) || !recipients.length) {
    throw new Error('At least one recipient required');
  }
  const sample = {
    name:       'Jane Doe',
    firstName:  'Jane',
    email:      'jane@studio.com',
    created_at: formatTimestamp(new Date()),
    admin_url:  process.env.ADMIN_BASE_URL
                  ? `${process.env.ADMIN_BASE_URL}/ballpark-settings/early-access`
                  : 'https://theballpark.ai/ballpark-settings/early-access'
  };
  const finalSubject = '[TEST] ' + renderTemplate(subject || '', sample);
  const finalText    = renderTemplate(body_template || '', sample) +
                       '\n\n— This is a test email sent from the Ballpark admin Settings tab.';
  return sendEmail({ to: recipients, subject: finalSubject, text: finalText });
}

// v1.65gZ32 — soft-delete a signup row. Sets deleted_at = NOW(); the
// partial unique index on lower(email) WHERE deleted_at IS NULL means
// the same person can re-sign-up if they want (useful for QA reseeding
// and for honoring a real "remove me" request without losing audit
// history of the original submission).
async function softDeleteSignup(id) {
  const { rowCount, rows } = await pool.query(
    `UPDATE marketing.guestlist_signup
        SET deleted_at = NOW()
      WHERE id = $1
        AND deleted_at IS NULL
      RETURNING id, email`,
    [id]
  );
  if (!rowCount) {
    return { ok: false, status: 404, error: 'Signup not found or already deleted' };
  }
  return { ok: true, body: { id: rows[0].id, email: rows[0].email, deleted: true } };
}

module.exports = {
  getPublicContent,
  getContentForAdmin,
  patchContent,
  getSettings,
  updateSettings,
  createSignup,
  listSignups,
  softDeleteSignup,
  sendTestEmail
};
