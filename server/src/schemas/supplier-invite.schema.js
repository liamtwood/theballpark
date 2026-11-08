// pV2-INVITE-SUPPLIER-01 — Zod input schemas for the supplier-invite routes.

const { z } = require('zod');

const optText = (max) => z.string().trim().max(max).optional().nullable()
  .transform((v) => (v ? v : null));

/** POST /api/projects-v2/:id/suppliers/invite */
const SupplierInviteSchema = z.object({
  businessName: z.string().trim().min(2).max(100),
  contactName: optText(100),
  email: z.string().trim().toLowerCase().pipe(z.email()).refine((v) => v.length <= 254, 'Email too long'),
  website: optText(300),
  categoryId: z.string().uuid(),
});

/** POST /api/onboarding/accept-supplier-invite */
const AcceptSupplierInviteSchema = z.object({
  supplierOrgId: z.string().uuid(),
});

module.exports = { SupplierInviteSchema, AcceptSupplierInviteSchema };
