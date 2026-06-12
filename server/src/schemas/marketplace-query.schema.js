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
    offset: z.coerce.number().int().min(0).max(100000).default(0),
  })
  .strip();

module.exports = { ItemsQuerySchema, PAGE_SIZE };
