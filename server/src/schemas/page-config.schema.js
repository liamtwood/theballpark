// pV2-04 — Zod schema for the v2 home page-settings payload (the object the
// drawer auto-saves). Canonical input definition for PUT /api/config/:orgType
// on the v2 (cookie) path; mirrors PageConfigPayload in
// client-v2/src/app/core/config/page-config.types.ts.
// All fields optional — partial payloads are valid; client computeds default
// missing keys.

const { z } = require('zod');

const PageConfigSchema = z
  .object({
    // Hero
    heroTitleMode: z.enum(['greeting', 'username', 'orgName', 'fixed']).optional(),
    heroTitleFixed: z.string().trim().max(80).optional(),
    heroSubtitle: z.string().trim().max(120).optional(),
    heroColor: z.enum(['theme', 'none']).optional(),
    heroAlign: z.enum(['left', 'center']).optional(),

    // Section toggles
    showStats: z.boolean().optional(),
    showUpcoming: z.boolean().optional(),
    showQuickActions: z.boolean().optional(),
    showRecentActivity: z.boolean().optional(),
    showCredits: z.boolean().optional(),
    showSavedSuppliers: z.boolean().optional(),

    // Labels
    creditLabel: z.string().trim().min(1).max(30).optional(),
    eventLabel: z.string().trim().min(1).max(30).optional(),
    clientLabel: z.string().trim().min(1).max(30).optional(),
  })
  // Unknown keys are stripped, not errored — old clients sending retired
  // fields must not brick the drawer; the schema defines what PERSISTS.
  .strip();

module.exports = { PageConfigSchema };
