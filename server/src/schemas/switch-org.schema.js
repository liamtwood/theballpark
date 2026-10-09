// Zod schema for POST /auth/switch-org. The orgId is only a CLAIM here; the
// service proves active membership before honouring it (org_id is sacred — never
// trusted from the body without an EXISTS check). Session-only switch (v2dev).
const { z } = require('zod');

// Accept any CANONICAL uuid string — NOT z.string().uuid(), which enforces the
// RFC-4122 version/variant nibbles and so rejects our sentinel org PKs (Ballpark
// = 0000…0001, System = 0000…0000). Postgres `uuid` accepts all-zeros, so these
// are valid PKs; the switch to Ballpark 400'd on the stricter check ("Return to
// Ballpark did nothing" — the client POST rejected before the redirect).
const UUID_CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SwitchOrgSchema = z
  .object({ orgId: z.string().regex(UUID_CANONICAL, 'Invalid org id') })
  .strip();

module.exports = { SwitchOrgSchema };
