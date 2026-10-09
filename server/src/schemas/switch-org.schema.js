// Zod schema for POST /auth/switch-org. The orgId is only a CLAIM here; the
// service proves active membership before honouring it (org_id is sacred — never
// trusted from the body without an EXISTS check). Session-only switch (v2dev).
const { z } = require('zod');

const SwitchOrgSchema = z.object({ orgId: z.string().uuid() }).strip();

module.exports = { SwitchOrgSchema };
