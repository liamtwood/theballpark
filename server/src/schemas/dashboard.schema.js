// pV2-04 — Zod schemas for /api/dashboard/* query params.

const { z } = require('zod');

/** ?limit= — bounded; coerced from the query string. */
const LimitSchema = (def, max) =>
  z.object({
    limit: z.coerce.number().int().min(1).max(max).default(def),
  });

module.exports = {
  UpcomingQuerySchema: LimitSchema(3, 10),
  ActivityQuerySchema: LimitSchema(10, 50),
  SavedSuppliersQuerySchema: LimitSchema(4, 20),
};
