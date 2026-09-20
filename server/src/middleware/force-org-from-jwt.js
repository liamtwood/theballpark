// pV2-SECURITY-RLS-01 §2c (BE-00109) — the server-derived org ALWAYS wins.
//
// The legacy v1 routes (/api/items, /api/categories, /api/projects,
// /api/project-items) read `org_id` from the client (query string / body) — a
// cross-org IDOR (`/api/items?org_id=<any other org>`). Now that those mounts sit
// behind `authenticate`, overwrite any client-supplied org_id with the verified
// JWT org so a handler can never act on another tenant, whatever the client sent.
module.exports = function forceOrgFromJwt(req, _res, next) {
  const orgId = req.user && req.user.org_id;
  if (orgId) {
    if (req.query && typeof req.query === 'object') req.query.org_id = orgId;
    if (req.body && typeof req.body === 'object') req.body.org_id = orgId;
  }
  next();
};
