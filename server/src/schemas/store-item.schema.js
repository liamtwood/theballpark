// pV2-STORE-01 — Zod schemas for the supplier-facing item editor
// (POST/PUT /api/store/items). org_id is NEVER taken from the body — it comes
// from the session. approval_status is restricted to the values a SUPPLIER may
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
    // pV2-STORE-01 (data model) — the installation cost (separate line).
    install_cost: z.coerce.number().min(0).max(100_000_000).nullable().optional(),
    // "Included Services" blurb + free-text location coverage.
    install_description: z.string().trim().max(5000).nullable().optional(),
    location_coverage: z.string().trim().max(2000).nullable().optional(),
    // ISO-4217 (defaults to the supplier's org currency server-side if omitted).
    currency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
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
