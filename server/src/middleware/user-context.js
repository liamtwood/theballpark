/**
 * User context middleware (Item 1 — audit attribution).
 *
 * Resolves the acting user for the request and stashes it in AsyncLocalStorage
 * so db/pool.js can `SET LOCAL app.current_user_id` on writes — which the audit
 * stamp trigger reads as current_user_id().
 *
 * Stopgap identity: the `x-bp-user-id` header (the same value the admin gate
 * already uses — a real users.id uuid resolved client-side from /org/users),
 * validated to uuid shape here so nothing arbitrary reaches the DB. When real
 * Supabase JWT auth lands, resolve from the verified token instead.
 */
const { als } = require('../db/request-context');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function userContext(req, _res, next) {
  const raw = req.header('x-bp-user-id');
  const userId = raw && UUID_RE.test(raw) ? raw : null;
  als.run({ userId }, () => next());
}

module.exports = userContext;
