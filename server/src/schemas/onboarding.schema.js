// pV2-AUDIT-03 — Zod input schemas for /api/onboarding. The schema is the
// canonical definition of what the endpoint accepts (WORKING_STANDARDS
// §"API audit checklist" — input validation); routes safeParse and return
// 400 { error, details } on failure. Schemas live here, not inline in the
// route, so they can be unit-tested independently and shared if a second
// consumer appears.

const { z } = require('zod');

/** POST /api/onboarding/create-org body. */
const CreateOrgSchema = z.object({
  orgType: z.enum(['agency', 'supplier']),
  orgName: z.string().trim().min(2).max(100),
});

module.exports = { CreateOrgSchema };
