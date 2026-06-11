// pV2-04 — agent home dashboard reads. Mounted on the GATED v2 router
// (`v2.use('/dashboard', …)` in index.js) so every endpoint inherits
// authenticate + requireActiveMembership; org scoping is ALWAYS
// req.user.org_id (never query/body). All reads, no writes, no transactions.
//
// Path note (ship report): the spec sketched /api/credits/balance and
// /api/suppliers/saved as "likely existing v1 endpoints — verify". Verified:
// neither exists (v1 reads balls_balance off the org row client-side and
// favourites via its own router). Rather than minting two new top-level
// namespaces for one consumer, all five home reads live under
// /api/dashboard/*.

const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const {
  UpcomingQuerySchema,
  ActivityQuerySchema,
  SavedSuppliersQuerySchema,
} = require('../schemas/dashboard.schema');

/** Shared 400 helper for query validation. */
function parseQuery(schema, req, res) {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid input', details: z.flattenError(parsed.error).fieldErrors });
    return null;
  }
  return parsed.data;
}

// GET /api/dashboard/stats → { active, openBriefs, awaiting, credits }
router.get('/stats', async (req, res, next) => {
  try {
    const orgId = req.user.org_id;
    const r = await pool.query(
      `SELECT
         (SELECT COUNT(*) FROM projects p
           WHERE p.org_id = $1 AND p.deleted_at IS NULL AND p.is_active = true) AS active,
         (SELECT COUNT(*) FROM messages m
            JOIN projects p ON p.id = m.project_id
           WHERE p.org_id = $1 AND p.deleted_at IS NULL AND m.deleted_at IS NULL
             AND m.direction = 'outbound' AND m.msg_status = 'sent')          AS open_briefs,
         (SELECT COUNT(*) FROM messages m
            JOIN projects p ON p.id = m.project_id
           WHERE p.org_id = $1 AND p.deleted_at IS NULL AND m.deleted_at IS NULL
             AND m.direction = 'inbound' AND m.read = false)                  AS awaiting,
         (SELECT o.balls_balance FROM orgs o
           WHERE o.id = $1 AND o.deleted_at IS NULL)                          AS credits`,
      [orgId]
    );
    const row = r.rows[0];
    res.json({
      active: Number(row.active),
      openBriefs: Number(row.open_briefs),
      awaiting: Number(row.awaiting),
      credits: Number(row.credits ?? 0),
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/upcoming?limit=3 → most recent dated active projects.
// projects.event_date is legacy FREE TEXT ("25–30 May 2026", "2027", …) so
// date-ordering is impossible — ordered by created_at DESC instead, and the
// raw string ships as dateLabel. Schema debt flagged in the ship report.
router.get('/upcoming', async (req, res, next) => {
  try {
    const q = parseQuery(UpcomingQuerySchema, req, res);
    if (!q) return;
    const r = await pool.query(
      `SELECT p.id, COALESCE(p.event_name, p.name) AS name, c.name AS client_name,
              p.venue_name, p.event_date
         FROM projects p
         LEFT JOIN clients c ON c.id = p.client_id AND c.deleted_at IS NULL
        WHERE p.org_id = $1 AND p.deleted_at IS NULL AND p.is_active = true
          AND p.event_date IS NOT NULL
        ORDER BY p.created_at DESC
        LIMIT $2`,
      [req.user.org_id, q.limit]
    );
    res.json(r.rows.map((row) => ({
      id: row.id,
      name: row.name,
      clientName: row.client_name,
      venueName: row.venue_name,
      dateLabel: row.event_date, // legacy free text, displayed verbatim
    })));
  } catch (err) { next(err); }
});

// GET /api/dashboard/activity?limit=10 → recent org events (projects created,
// suppliers saved, messages received), newest first.
router.get('/activity', async (req, res, next) => {
  try {
    const q = parseQuery(ActivityQuerySchema, req, res);
    if (!q) return;
    const r = await pool.query(
      `SELECT * FROM (
         SELECT p.id::text AS id, 'project_created' AS kind,
                COALESCE(u.display_name, u.name) AS actor_name,
                COALESCE(p.event_name, p.name)   AS subject,
                p.created_at AS at
           FROM projects p
           LEFT JOIN users u ON u.id = p.created_by
          WHERE p.org_id = $1 AND p.deleted_at IS NULL
         UNION ALL
         SELECT f.id::text, 'supplier_saved',
                COALESCE(u.display_name, u.name),
                o.name,
                f.created_at
           FROM favourites f
           JOIN orgs o ON o.id = f.ref_id
           LEFT JOIN users u ON u.id = f.created_by
          WHERE f.org_id = $1 AND f.type = 'supplier'
            AND f.deleted_at IS NULL AND f.is_active = true
         UNION ALL
         SELECT m.id::text, 'reply_received',
                COALESCE(m.supplier_name, 'Supplier'),
                COALESCE(m.subject, p2.name),
                m.created_at
           FROM messages m
           JOIN projects p2 ON p2.id = m.project_id
          WHERE p2.org_id = $1 AND m.direction = 'inbound'
            AND m.deleted_at IS NULL AND p2.deleted_at IS NULL
       ) ev
       ORDER BY ev.at DESC
       LIMIT $2`,
      [req.user.org_id, q.limit]
    );
    res.json(r.rows.map((row) => ({
      id: row.id,
      kind: row.kind,
      actorName: row.actor_name,
      subject: row.subject,
      at: row.at, // ISO-8601 — client renders the relative label
    })));
  } catch (err) { next(err); }
});

// GET /api/dashboard/credits → { balance, monthlyAllowance }
router.get('/credits', async (req, res, next) => {
  try {
    const r = await pool.query(
      `SELECT balls_balance, balls_monthly_allowance
         FROM orgs WHERE id = $1 AND deleted_at IS NULL`,
      [req.user.org_id]
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Organisation not found' });
    res.json({
      balance: Number(r.rows[0].balls_balance ?? 0),
      monthlyAllowance: Number(r.rows[0].balls_monthly_allowance ?? 0),
    });
  } catch (err) { next(err); }
});

// GET /api/dashboard/saved-suppliers?limit=4 → favourite supplier orgs
router.get('/saved-suppliers', async (req, res, next) => {
  try {
    const q = parseQuery(SavedSuppliersQuerySchema, req, res);
    if (!q) return;
    const r = await pool.query(
      `SELECT o.id, o.name, o.logo_url, o.city
         FROM favourites f
         JOIN orgs o ON o.id = f.ref_id AND o.deleted_at IS NULL
        WHERE f.org_id = $1 AND f.type = 'supplier'
          AND f.deleted_at IS NULL AND f.is_active = true
        ORDER BY f.created_at DESC
        LIMIT $2`,
      [req.user.org_id, q.limit]
    );
    res.json(r.rows.map((row) => ({
      id: row.id, name: row.name, logoUrl: row.logo_url, city: row.city,
    })));
  } catch (err) { next(err); }
});

module.exports = router;
