// pV2-04b — Zod schema for the v2 home page-settings payload (the object the
// drawer auto-saves). Canonical input definition for PUT /api/config/:orgType
// on the v2 (cookie) path; mirrors PageConfigPayload in
// client-v2/src/app/core/config/page-config.types.ts.
// General-tab fields ONLY (launcher-only home — no section flags, no hero
// color). All fields optional — partial payloads are valid.

const { z } = require('zod');

// One page's hero pair — shared by every pages.* key (hero ONLY; v1's
// other per-page marketplace settings are deliberately not modelled).
const PageHeroOverrideSchema = z
  .object({
    title: z.string().trim().max(80).optional(),
    subtitle: z.string().trim().max(120).optional(),
  })
  .strip();

const PageConfigSchema = z
  .object({
    heroTitleMode: z.enum(['greeting', 'username', 'orgName', 'fixed']).optional(),
    heroTitleFixed: z.string().trim().max(80).optional(),
    heroSubtitle: z.string().trim().max(120).optional(),
    heroAlign: z.enum(['left', 'center']).optional(),

    creditLabel: z.string().trim().min(1).max(30).optional(),
    eventLabel: z.string().trim().min(1).max(30).optional(),
    clientLabel: z.string().trim().min(1).max(30).optional(),

    // Per-page hero overrides (title2/subtitle2 roles). Explicit page keys —
    // a new configurable page adds its key here, not a free-form record.
    pages: z
      .object({
        profile: PageHeroOverrideSchema.optional(),
        marketplace: PageHeroOverrideSchema.optional(),
      })
      .strip()
      .optional(),
  })
  // Unknown keys are stripped, not errored — retired fields from older
  // clients must not brick the drawer; the schema defines what PERSISTS.
  .strip();

module.exports = { PageConfigSchema };
