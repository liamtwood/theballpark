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

/** Partial update for the Project Details tab (PROJECTS-02). Every field
 *  optional; status is a codelist code (dual-written by the service).
 *  org_id NEVER accepted — the route scopes by JWT. */
const ProjectUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullable().optional(),
  eventType: z.string().trim().max(100).nullable().optional(),
  eventDate: z.string().trim().max(100).nullable().optional(),
  venueName: z.string().trim().max(200).nullable().optional(),
  venueCity: z.string().trim().max(100).nullable().optional(),
  venueAddress: z.string().trim().max(400).nullable().optional(),
  guestCount: z.number().int().nonnegative().nullable().optional(),
  durationDays: z.number().int().nonnegative().nullable().optional(),
  clientName: z.string().trim().max(200).nullable().optional(),
  projectBudget: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  tier: z.enum(['starter', 'professional', 'premium']).nullable().optional(),
  status: z.enum(['draft', 'active', 'completed', 'archived']).optional(),
  // Per-project financial rates (Estimate cascade). NUMERIC(5,2) → ≤ 999.99.
  defaultMarginPct: z.number().nonnegative().max(999.99).nullable().optional(),
  defaultContingencyPct: z.number().nonnegative().max(999.99).nullable().optional(),
  // Insurance is a % of project costs (like contingency). A flat insurance cost
  // is entered as a Fees line, not here — so there's no fixed-£ field.
  defaultInsurancePct: z.number().nonnegative().max(999.99).nullable().optional(),
  defaultVatPct: z.number().nonnegative().max(999.99).nullable().optional(),
  // Quote document options (per project).
  quoteThemeMode: z.enum(['default', 'bw', 'color']).nullable().optional(),
  quoteThemeColor: z.string().trim().max(40).nullable().optional(),
  quoteFooter: z.string().max(2000).nullable().optional(),
  // Media (pV2-MEDIA-01b) — the image-picker result maps to these.
  coverImageUrl: z.string().trim().max(1000).nullable().optional(),
  clientLogoUrl: z.string().trim().max(1000).nullable().optional(),
  cardColor: z.string().trim().max(40).nullable().optional(),
  iconName: z.string().trim().max(100).nullable().optional(),
  iconColor: z.string().trim().max(50).nullable().optional(),
  coverFocalX: z.number().int().min(0).max(100).nullable().optional(),
  coverFocalY: z.number().int().min(0).max(100).nullable().optional(),
  unsplashPhotographerName: z.string().trim().max(200).nullable().optional(),
  unsplashPhotoUrl: z.string().trim().max(1000).nullable().optional(),
  // Gallery (pV2-MEDIA-01c) — ordered array; "set as primary" copies one into
  // the cover_* columns. Bounded at 20; unknown keys per element are stripped.
  images: z
    .array(
      z.object({
        url: z.string().trim().min(1).max(1000),
        focalX: z.number().int().min(0).max(100).default(50),
        focalY: z.number().int().min(0).max(100).default(50),
        attribution: z
          .object({
            photographerName: z.string().trim().max(200),
            photoUrl: z.string().trim().max(1000),
          })
          .nullable()
          .optional(),
      })
    )
    .max(20)
    .optional(),
});

module.exports = { ProjectCreateSchema, ProjectUpdateSchema };
