const { z } = require('zod');

/** POST /api/coachmarks/resolve — the app registers/reads a coachmark. */
const ResolveSchema = z.object({
  page: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  description: z.string().max(2000).nullish(),
  tail: z.enum(['up', 'down']).nullish(),
});

/** PATCH /api/coachmarks/:id — admin edit (description / active / tail). */
const PatchSchema = z.object({
  description: z.string().max(2000).nullish(),
  isActive: z.boolean().optional(),
  tail: z.enum(['up', 'down']).optional(),
});

module.exports = { ResolveSchema, PatchSchema };
