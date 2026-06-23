// pV2-STORE-01 — Zod schemas for the supplier-facing item editor
// (POST/PUT /api/v2/store/items). org_id is NEVER taken from the body — it
// comes from the session. Only EXISTING item columns are accepted here; the
// install_cost / location_coverage / included_services fields are deferred
// (no columns yet). approval_status is restricted to the values a SUPPLIER may
// set — 'draft' (save) or 'pending' (submit). Ballpark approve/reject lands on
// a separate admin-gated route.

const { z } = require('zod');

const GalleryImageSchema = z.object({
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
});

const StoreItemCreateSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    category_id: z.string().uuid(),
    subcategory_id: z.string().uuid().nullable().optional(),
    description: z.string().trim().max(5000).nullable().optional(),
    base_price: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
    // Installed total (ballpark + install add-on) — stored in max_price.
    max_price: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
    unit: z.string().trim().max(40).nullable().optional(),
    lead_time_days: z.coerce.number().int().min(0).max(3650).nullable().optional(),
    image_url: z.string().trim().max(1000).nullable().optional(),
    images: z.array(GalleryImageSchema).max(20).optional(),
    tags: z.array(z.string().trim().max(60)).max(30).optional(),
    // A supplier may only set draft (save) or pending (submit). approved/
    // rejected are reserved for the ballpark admin route; is_active stays
    // server-controlled (false until approval).
    approval_status: z.enum(['draft', 'pending']).optional(),
  })
  .strip();

// Update = every field optional; status still restricted to draft|pending.
const StoreItemUpdateSchema = StoreItemCreateSchema.partial().strip();

module.exports = { StoreItemCreateSchema, StoreItemUpdateSchema };
