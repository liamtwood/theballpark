// pV2-ITEM-BULK-ACTIONS-01 — Zod schemas for the bulk item endpoints. The action
// enum is the per-persona value gate (defence-in-depth, not just hiding buttons):
// the OWNER schema has no approve/reject; approval_status a supplier can reach is only
// 'pending' (via 'submit'). reclassify requires a categoryId.

const { z } = require('zod');

const BULK_MAX_IDS = 500; // matches the extract per-pull / refresh cap

const OwnerBulkSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(BULK_MAX_IDS),
    action: z.enum(['activate', 'deactivate', 'reclassify', 'submit', 'delete', 'refresh-images']),
    // The deepest chosen taxonomy node (one category_id at any depth) — reclassify only.
    categoryId: z.uuid().optional(),
  })
  .strip()
  .refine((d) => d.action !== 'reclassify' || !!d.categoryId, {
    message: 'categoryId is required to reclassify',
    path: ['categoryId'],
  });

const AdminBulkSchema = z
  .object({
    ids: z.array(z.uuid()).min(1).max(BULK_MAX_IDS),
    action: z.enum(['approve', 'reject', 'delete', 'refresh-images']),
  })
  .strip();

module.exports = { OwnerBulkSchema, AdminBulkSchema, BULK_MAX_IDS };
