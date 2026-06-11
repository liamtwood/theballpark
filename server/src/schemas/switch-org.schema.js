// v2.12 — Zod schema for POST /auth/switch-org. The orgId is only a CLAIM
// here; the service proves membership inside the UPDATE statement (org_id is
// sacred — never trusted from the body without an EXISTS check).

const { z } = require('zod');

const SwitchOrgSchema = z
  .object({
    orgId: z.string().uuid(),
  })
  .strip();

module.exports = { SwitchOrgSchema };
