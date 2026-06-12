// pV2 Profile — Zod schema for PUT /api/organisation (the org's own profile
// + financial defaults; the v2 port of v1's /settings/organisation form).

const { z } = require('zod');

const OrganisationUpdateSchema = z
  .object({
    name: z.string().trim().min(2).max(100).optional(),
    address: z.string().trim().max(200).optional(),
    city: z.string().trim().max(80).optional(),
    email: z.string().trim().email().max(120).optional().or(z.literal('')),
    phone: z.string().trim().max(40).optional(),
    refPrefix: z
      .string()
      .trim()
      .max(4)
      .transform((v) => v.toUpperCase())
      .optional()
      .or(z.literal('')),
    defaultVatPct: z.coerce.number().min(0).max(100).optional(),
    defaultMarginPct: z.coerce.number().min(0).max(100).optional(),
    defaultContingencyPct: z.coerce.number().min(0).max(100).optional(),
    // pV2-CODELISTS-02: codelist-fed selects (country / currency codelists).
    // Shape-validated here; the VALUE space lives in the codelist rows.
    // country IS clearable ('' → NULL); defaultCurrency deliberately is NOT
    // — an org always has a default currency (audit 02-F-3, documented).
    country: z.string().trim().regex(/^[A-Z]{2}$/).optional().or(z.literal('')),
    defaultCurrency: z.string().trim().regex(/^[A-Z]{3}$/).optional(),
  })
  .strip();

module.exports = { OrganisationUpdateSchema };
