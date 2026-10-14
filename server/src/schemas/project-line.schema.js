// pV2-PROJECTS-S2 (rebuild) — the line-cluster request bodies. org_id is NEVER
// accepted here; the route supplies it from the JWT. lineId/itemId path slots
// are validated as UUIDs by the route's router.param guards.

const { z } = require('zod');

/** The chosen variant on a catalogue add (pV2-STORE-VARIANTS-UPCHARGE-01). */
const VariantSchema = z.object({
  values: z.record(z.string(), z.string()).optional(),
  upcharge: z.number().optional(),
  label: z.string().nullable().optional(),
}).nullable();

/** POST /:id/items — add a catalogue item (freeze clone). */
const ItemAddSchema = z.object({
  itemId: z.string().uuid(),
  variant: VariantSchema.optional(),
  quantity: z.number().int().positive().optional(),
});

/** POST /:id/items/custom — add an ad-hoc line (no catalogue backing). */
const CustomItemSchema = z.object({
  categoryId: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(4000).nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  installed: z.boolean().nullable().optional(),
  installCost: z.number().nonnegative().nullable().optional(),
  installUnit: z.string().trim().max(50).nullable().optional(),
  // S3 engagement fields the client may still send — accepted, ignored at S2.
  supplierOrgId: z.string().uuid().nullable().optional(),
  optionOfLineId: z.string().uuid().nullable().optional(),
});

/** PATCH /:id/items/:lineId — quantity and/or install choice. */
const ItemPatchSchema = z.object({
  quantity: z.number().int().positive().optional(),
  installed: z.boolean().nullable().optional(),
}).refine((b) => b.quantity !== undefined || b.installed !== undefined, {
  message: 'Provide quantity or installed',
});

/** PATCH /:id/items/:itemId/details — free-text + agent-editable fields. */
const LineDetailsSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(4000).nullable().optional(),
  services: z.string().max(4000).nullable().optional(),
  details: z.string().max(8000).nullable().optional(),
  cost: z.number().nonnegative().nullable().optional(),
  unit: z.string().trim().max(50).nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
});

/** PUT /:id/items/:itemId/quote-description — the agent's client-facing text. */
const QuoteDescriptionSchema = z.object({
  quoteDescription: z.string().max(8000).nullable(),
});

module.exports = {
  ItemAddSchema, CustomItemSchema, ItemPatchSchema, LineDetailsSchema, QuoteDescriptionSchema,
};
