// Codelist consumer-identifier guard, PURE (no db/pool import) so the Rule-8
// specs run without opening live connections.
//
// The deactivation-gate count interpolates a consumer's table/column IDENTIFIERS
// into SQL (identifiers can't be parameterised). In the redesigned model those
// identifiers come from reference_codelist_consumers — admin/seed-written, trusted
// data — but we still shape-guard every one so a malformed registry row can never
// reach SQL. A bare lowercase snake identifier only; anything else fails closed.

const IDENT_RE = /^[a-z_][a-z0-9_]*$/;

/** True when `id` is a safe bare SQL identifier (table or column name). */
function isSafeIdentifier(id) {
  return typeof id === 'string' && IDENT_RE.test(id);
}

/** Known consumer refs (table.column) in the current model — reference/defense
 *  documentation; the live gate is isSafeIdentifier on the trusted registry. */
const CONSUMER_WHITELIST = new Set([
  'items.unit',
  'items.tier',
  'items.approval_status',
  'projects.tier',
  'projects.status',
  'projects.project_type',
  'project_categories.status',
  'messages.status',
  'user_orgs.status',
  'orgs.country',
  'orgs.default_currency',
]);

module.exports = { isSafeIdentifier, CONSUMER_WHITELIST };
