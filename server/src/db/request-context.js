/**
 * Per-request context (AsyncLocalStorage).
 *
 * Carries the resolved acting user id for the duration of a request so the
 * pool wrapper (db/pool.js) can `SET LOCAL app.current_user_id` on writes —
 * which the audit stamp trigger reads as `current_user_id()`. No dependency on
 * pg or express here, so pool.js and the middleware both require it without a
 * cycle.
 */
const { AsyncLocalStorage } = require('async_hooks');

const als = new AsyncLocalStorage();

/** Current request's context, or undefined outside a request. */
function getContext() {
  return als.getStore();
}

module.exports = { als, getContext };
