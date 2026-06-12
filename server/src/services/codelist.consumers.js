// pV2-CODELISTS-01 — the consumer-pointer whitelist, PURE (no db/pool
// import) so the Rule-8 specs run without opening live connections.
// The deactivation-gate count interpolates table/column IDENTIFIERS into
// SQL; identifiers can't be parameterised, so the parent row's pointer is
// double-checked here — a poisoned row can never reach SQL.

const CONSUMER_WHITELIST = new Set([
  'items.unit',
  'items.time_unit',
  'items.approval_status',
  'projects.currency',
  'projects.tier',
  'projects.status',
  'project_categories.status',
  'messages.status',
  'user_orgs.status',
  'orgs.country',
]);

function consumerRef(parent) {
  if (!parent || !parent.consumer_table || !parent.consumer_column) return null;
  const ref = `${parent.consumer_table}.${parent.consumer_column}`;
  return CONSUMER_WHITELIST.has(ref) ? ref : null;
}

module.exports = { CONSUMER_WHITELIST, consumerRef };
