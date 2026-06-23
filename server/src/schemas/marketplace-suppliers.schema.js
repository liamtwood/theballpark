// pV2-06d — Zod schemas for the suppliers browse + favourites toggle.

const { z } = require('zod');

const SuppliersQuerySchema = z
  .object({
    cat: z.uuid().optional(),
    q: z.string().trim().max(80).optional(),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strip();

/** POST /api/marketplace/favourites — org-scoped toggle. */
const FavouriteToggleSchema = z
  .object({
    type: z.enum(['item', 'supplier']),
    refId: z.uuid(),
  })
  .strip();

module.exports = { SuppliersQuerySchema, FavouriteToggleSchema };
