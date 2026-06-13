const { z } = require('zod');

/** pV2-PROJECTS-03 (scoped: brief → project, no items). The create body
 *  is the AI-parsed brief mapped to project fields — everything optional
 *  except a name (defaulted if the parser didn't find one). org_id is
 *  NEVER accepted here; the route supplies it from the JWT. */
const ProjectCreateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).optional(),
  eventType: z.string().trim().max(100).optional(),
  eventDate: z.string().trim().max(100).optional(),
  venueName: z.string().trim().max(200).optional(),
  venueCity: z.string().trim().max(100).optional(),
  guestCount: z.number().int().nonnegative().nullable().optional(),
  durationDays: z.number().int().nonnegative().nullable().optional(),
  // Matches the projects_tier_check constraint (codelist drops 'unknown'
  // → the client maps it to null). Lowercased by the client from the
  // parser's capitalised budgetSignal.
  tier: z.enum(['starter', 'professional', 'premium']).optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  rawBriefText: z.string().max(50_000).optional(),
  /** The full ParsedBrief payload, stored as-is for later surfaces. */
  parsedBrief: z.unknown().optional(),
});

module.exports = { ProjectCreateSchema };
