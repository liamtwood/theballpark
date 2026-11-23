// pV2-ADMIN-ORG-EDIT-01 — admin cross-org EDIT escape (profile + items).
//
// FR-00215 closed admin content-WRITE at the DB: the orgs/items UPDATE+INSERT
// policies gate on `= app_current_org()` (plus the narrow svc_moderate /
// svc_refresh escapes) and do NOT honour app_is_admin() — so a ballpark admin
// editing an org they hold no seat in silently no-ops (0 rows).
//
// withActingOrg(orgId, fn) runs fn with the request temporarily ACTING AS `orgId`:
// app.current_org_id is set to the target so the `= app_current_org()` branch of
// the write policies permits it, WITHOUT re-granting is_admin writes at the DB —
// the documented "act as the org" pattern. It is called ONLY from the admin routes
// already gated by admin.cross_org_view (routes/admin-orgs.js), so the capability
// stays confined and auditable there.
//
// The override is published on the ALS request context as `actingOrgId`, which
// db/with-transaction.js prefers over the caller's real org when setting the txn
// GUC — that covers service writes that open their OWN transaction client
// (updateOrgProfile, item writes). The request-pinned client's GUC is overridden
// too, for any write that goes straight through db/pool.js. Both are restored in
// `finally`, so the rest of the request runs as the admin's real org again.
//
// No request context / no target → fn runs unwrapped and the cross-org write is
// denied by RLS, which is the safe default (mirrors lib/moderation.js).
const { als } = require('../db/request-context');

async function withActingOrg(orgId, fn) {
  const ctx = als.getStore();
  if (!ctx || !orgId) return fn(); // no request context / no target → RLS denies cross-org write

  const prevActing = ctx.actingOrgId;
  ctx.actingOrgId = orgId; // preferred by withTransaction when it sets app.current_org_id

  const client = ctx.client; // the request-pinned client (direct pool.js writes)
  let prevGuc;
  if (client) {
    prevGuc = (await client.query("SELECT current_setting('app.current_org_id', true) AS v")).rows[0].v;
    await client.query("SELECT set_config('app.current_org_id', $1, false)", [orgId]);
  }

  try {
    return await fn();
  } finally {
    ctx.actingOrgId = prevActing;
    if (client) {
      await client
        .query("SELECT set_config('app.current_org_id', $1, false)", [prevGuc == null ? '' : prevGuc])
        .catch(() => {});
    }
  }
}

module.exports = { withActingOrg };
