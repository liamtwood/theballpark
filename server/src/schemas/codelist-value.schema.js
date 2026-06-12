// pV2-CODELISTS-01 — Zod schemas for the gated v2 codelist curation.

const { z } = require('zod');

/** POST /api/codelists/:list/values — add a value (ballpark lists only). */
const CodelistValueCreateSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(1)
      .max(50)
      .regex(/^[a-zA-Z0-9_-]+$/, 'code: letters, digits, _ and - only'),
    label: z.string().trim().min(1).max(100),
    symbol: z.string().trim().max(20).optional().or(z.literal('')),
    description: z.string().trim().max(300).optional().or(z.literal('')),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
  })
  .strip();

/** PATCH /api/codelists/:list/values/:code — curation edits. */
const CodelistValuePatchSchema = z
  .object({
    label: z.string().trim().min(1).max(100).optional(),
    symbol: z.string().trim().max(20).optional().or(z.literal('')),
    description: z.string().trim().max(300).optional().or(z.literal('')),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional(),
    isActive: z.boolean().optional(),
  })
  .strip()
  .refine((o) => Object.keys(o).length > 0, { message: 'No editable fields provided' });

/** :list / :code route params. */
const ListNameSchema = z.string().trim().min(1).max(100).regex(/^[a-z0-9_]+$/);
const CodeParamSchema = z.string().trim().min(1).max(50).regex(/^[a-zA-Z0-9_-]+$/);

module.exports = {
  CodelistValueCreateSchema,
  CodelistValuePatchSchema,
  ListNameSchema,
  CodeParamSchema,
};
