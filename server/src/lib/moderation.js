// FR-00215 moderation escape. Admin content-WRITE is closed at the DB (RLS write =
// current-org only). The two legitimate cross-org admin moderation writes —
// approve/reject an item (items.approval_status) and suspend/approve an org
// (orgs.status) — run inside withModeration(), which sets the app.svc_moderate GUC
// on the REQUEST'S PINNED CLIENT (the same one pool.query uses) for just that write,
// then always clears it. The RLS branch keyed on app_svc_moderate() then permits
// that specific write; the route is responsible for only touching the moderated
// column(s). No pinned client (background) → the branch stays off and the write is
// denied, which is the safe default.
const { als } = require('../db/request-context');

async function withModeration(fn) {
  const ctx = als.getStore();
  const client = ctx && ctx.client;
  if (!client) return fn(); // no request context → RLS branch off (cross-org write will be denied)
  await client.query("SELECT set_config('app.svc_moderate','t',false)");
  try {
    return await fn();
  } finally {
    await client.query("SELECT set_config('app.svc_moderate','f',false)").catch(() => {});
  }
}

module.exports = { withModeration };
