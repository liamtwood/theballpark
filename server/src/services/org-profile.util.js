// pV2-ADMIN-ORG-PROFILE-EDIT-01 — shared org-profile projection + update builder,
// so the self-serve PUT /api/organisation and the admin PUT /api/admin/orgs/:id
// use ONE definition (no duplicated field-set logic). camelCase out.

const ORG_PROFILE_SELECT = `SELECT id, name, description, website, address, city, country, email, phone, ref_prefix, ref_counter,
       default_vat_pct, default_margin_pct, default_contingency_pct, default_currency,
       logo_url, cover_image_url, images, terms_pdf_url, company_number
  FROM orgs WHERE id = $1 AND deleted_at IS NULL`;

function toProfile(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    website: row.website ?? null,
    address: row.address,
    city: row.city,
    email: row.email,
    phone: row.phone,
    country: row.country,
    refPrefix: row.ref_prefix,
    refCounter: Number(row.ref_counter ?? 0),
    defaultCurrency: row.default_currency ?? 'GBP',
    defaultVatPct: Number(row.default_vat_pct ?? 0),
    defaultMarginPct: Number(row.default_margin_pct ?? 0),
    defaultContingencyPct: Number(row.default_contingency_pct ?? 0),
    logoUrl: row.logo_url ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    images: Array.isArray(row.images) ? row.images : [],
    termsPdfUrl: row.terms_pdf_url ?? null,
    companyNumber: row.company_number ?? null,
  };
}

/**
 * Build a partial UPDATE from a parsed OrganisationUpdateSchema body.
 * Returns { sets, vals } where vals are the column values in order; the caller
 * pushes the id as the final placeholder and appends `WHERE id = $N`.
 * `images` (jsonb) is serialized + cast. Empty-string clears mirror the
 * documented self-serve rules (description/refPrefix/country/companyNumber).
 */
function buildOrgUpdate(p) {
  const map = {
    name: p.name,
    description: p.description === '' ? null : p.description,
    website: p.website === '' ? null : p.website,
    address: p.address,
    city: p.city,
    email: p.email,
    phone: p.phone,
    ref_prefix: p.refPrefix === '' ? null : p.refPrefix,
    country: p.country === '' ? null : p.country,
    default_currency: p.defaultCurrency,
    default_vat_pct: p.defaultVatPct,
    default_margin_pct: p.defaultMarginPct,
    default_contingency_pct: p.defaultContingencyPct,
    logo_url: p.logoUrl,
    cover_image_url: p.coverImageUrl,
    terms_pdf_url: p.termsPdfUrl,
    company_number: p.companyNumber === '' ? null : p.companyNumber,
  };
  const sets = [];
  const vals = [];
  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      vals.push(val);
      sets.push(`${col} = $${vals.length}`);
    }
  }
  if (p.images !== undefined) {
    vals.push(JSON.stringify(p.images));
    sets.push(`images = $${vals.length}::jsonb`);
  }
  return { sets, vals };
}

module.exports = { ORG_PROFILE_SELECT, toProfile, buildOrgUpdate };
