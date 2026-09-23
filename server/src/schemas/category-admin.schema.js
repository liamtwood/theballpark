// pV2-MARKET-00 — Zod schema for PATCH /api/marketplace/categories/:id
// (ballpark-admin category curation: rename, tagline, active flag, sort).
// Structural fields (parent_id, namespace, level) are NOT editable here —
// the hierarchy is seed/migration territory, not a curation surface.

const { z } = require('zod');

const CategoryUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(60).optional(),
    tagline: z.string().trim().max(120).optional().or(z.literal('')),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  })
  .strip()
  .refine((o) => Object.keys(o).length > 0, { message: 'No editable fields provided' });

// POST /api/marketplace/categories — create a node (category / subcategory /
// sub-subcategory). `parentId` null = a top-level category; otherwise a child of
// that node (the server derives `level` from the parent chain). Admin-gated.
const CategoryCreateSchema = z
  .object({
    name: z.string().trim().min(2).max(60),
    parentId: z.uuid().nullish(),
    tagline: z.string().trim().max(120).optional().or(z.literal('')),
    isActive: z.boolean().optional(),
    sortOrder: z.coerce.number().int().min(0).max(999).optional(),
  })
  .strip();

module.exports = { CategoryUpdateSchema, CategoryCreateSchema };
