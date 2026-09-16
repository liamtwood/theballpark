const { z } = require('zod');

// pV2-WHATSNEW-REDESIGN-01 — user-facing "Report an issue" create.
// Allows ONLY the safe user-supplied fields; identity/trust fields
// (submitted_by, environment, status, owner, target_version, priority,
// object_type) are set server-side and never accepted from the body.
// `.strip()` drops any unknown/privileged keys silently rather than 400ing,
// so an over-eager client can't smuggle them in.
const FeedbackCreateSchema = z
  .object({
    type: z.enum(['bug', 'enhancement', 'question']),
    feedback_category_id: z.string().uuid().nullish(),
    area_category_id: z.string().uuid().nullish(),
    title: z.string().trim().min(1).max(255),
    description: z.string().max(8000).nullish(),
    notes: z.string().max(8000).nullish(),
    page_url: z.string().max(500).nullish(),
    pages: z.array(z.string().max(500)).max(50).optional(),
  })
  .strip();

module.exports = { FeedbackCreateSchema };
