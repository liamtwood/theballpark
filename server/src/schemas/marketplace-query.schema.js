// pV2-06a — Zod schema for GET /api/marketplace/items query params.
// Born paginated: PAGE_SIZE is the server-owned constant (MARKETPLACE.md
// ruling — 48, generous enough that most users never page).

const { z } = require('zod');

const PAGE_SIZE = 48;

const ItemsQuerySchema = z
  .object({
    cat: z.uuid().optional(),
    sub: z.uuid().optional(),
    q: z.string().trim().max(80).optional(),
    // pV2-06c filters — the three dimensions with real data behind them
    // (items.attributes is EMPTY in the catalogue; the category-specific
    // dimension filters stay deferred until supplier editing creates it).
    priceMin: z.coerce.number().min(0).max(1000000).optional(),
    priceMax: z.coerce.number().min(0).max(1000000).optional(),
    tier: z.enum(['basic', 'mid', 'premium']).optional(),
    supplier: z.uuid().optional(),
    // pV2-STORE-01 — owner store filters. These ONLY take effect when the
    // caller owns the `supplier` org (server-enforced); for everyone else the
    // grid stays active+approved. `status` filters approval_status; `active`
    // filters the publish toggle (inactive = draft/hidden).
    status: z.enum(['draft', 'pending', 'approved', 'rejected', 'all']).optional(),
    active: z.enum(['active', 'inactive', 'all']).optional(),
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strip();

module.exports = { ItemsQuerySchema, PAGE_SIZE };
