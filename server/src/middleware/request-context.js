// pV2-SECURITY-RLS-01 §3 (BE-00110) — per-request DB context from the verified JWT.
//
// Seeds AsyncLocalStorage {userId, orgId, isAdmin} from req.user (set by
// `authenticate`) and PINS one pooled client for the request, SET_CONFIG-ing the
// three audit/RLS GUCs on it once. `db/pool.js` prefers this pinned client, so
// EVERY query — reads included — carries app.current_org_id / app.current_user_id
// / app.is_admin (no per-read BEGIN/COMMIT). `RESET ALL` + release on response
// end so no org context leaks to the next request reusing that connection.
//
// NB: with DATABASE_URL still the schema OWNER, these GUCs change NO behaviour
// yet — the owner bypasses RLS. This is the plumbing the §1 policies enforce on
// once the role flips to web_app_user. Mount AFTER `authenticate` (needs req.user)
// and BEFORE the routes: authenticate → requestContext → requireActiveMembership.
const { als } = require('../db/request-context');
const pool = require('../db/pool');

module.exports = function requestContext(req, res, next) {
  if (!req.user) return next(); // unauthenticated path — nothing to pin
  const ctx = { userId: req.user.id, orgId: req.user.org_id, isAdmin: !!req.user.is_admin };
  als.run(ctx, () => {
    pool.connect().then((client) => {
      let released = false;
      const release = () => {
        if (released) return;
        released = true;
        // Session GUCs persist on a pooled connection — clear them before the
        // client returns to the pool, or the next request inherits this org.
        client.query('RESET ALL').catch(() => {}).finally(() => client.release());
      };
      // Session-level (third arg false) so the GUCs live for the whole request,
      // not just one txn — combined into one round-trip.
      client
        .query(
          "SELECT set_config('app.current_org_id',$1,false), set_config('app.current_user_id',$2,false), set_config('app.is_admin',$3,false)",
          [ctx.orgId || null, ctx.userId || null, ctx.isAdmin ? 't' : 'f'],
        )
        .then(() => {
          ctx.client = client; // db/pool.js prefers this for every query
          res.on('finish', release);
          res.on('close', release);
          next();
        })
        .catch((err) => {
          release();
          next(err);
        });
    }).catch(next);
  });
};
