// pV2-ADMIN-ORG-PROFILE-EDIT-01 — shared org-profile projection + update builder,
// so the self-serve PUT /api/organisation and the admin PUT /api/admin/orgs/:id
// use ONE definition (no duplicated field-set logic). camelCase out.

// v2dev: address/city/country live in the addresses satellite, surfaced via the
// org's primary address (orgs.primary_address_id). The profile editor edits ONE
// address line → addresses.line1 (aliased AS address), plus city + country.
const ORG_PROFILE_SELECT = `SELECT o.id, o.name, o.description, o.website, o.email, o.phone, o.ref_prefix, o.ref_counter,
       o.default_vat_pct, o.default_margin_pct, o.default_contingency_pct, o.default_currency,
       o.logo_url, o.cover_image_url, o.image_display, o.images, o.terms_pdf_url, o.company_number,
       a.line1 AS address, a.city AS city, a.country AS country
  FROM orgs o
  LEFT JOIN addresses a ON a.id = o.primary_address_id AND a.deleted_at IS NULL
 WHERE o.id = $1 AND o.deleted_at IS NULL`;

function toProfile(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    website: row.website ?? null,
    address: row.address ?? null,   // v2dev: addresses satellite (not yet wired)
    city: row.city ?? null,
    email: row.email,
    phone: row.phone,
    country: row.country ?? null,
    refPrefix: row.ref_prefix,
    refCounter: Number(row.ref_counter ?? 0),
    defaultCurrency: row.default_currency ?? 'GBP',
    defaultVatPct: Number(row.default_vat_pct ?? 0),
    defaultMarginPct: Number(row.default_margin_pct ?? 0),
    defaultContingencyPct: Number(row.default_contingency_pct ?? 0),
    logoUrl: row.logo_url ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    imageDisplay: row.image_display ?? 'cover',
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
    // address/city/country intentionally omitted on v2dev (addresses satellite).
    email: p.email,
    phone: p.phone,
    ref_prefix: p.refPrefix === '' ? null : p.refPrefix,
    default_currency: p.defaultCurrency,
    default_vat_pct: p.defaultVatPct,
    default_margin_pct: p.defaultMarginPct,
    default_contingency_pct: p.defaultContingencyPct,
    logo_url: p.logoUrl,
    cover_image_url: p.coverImageUrl,
    image_display: p.imageDisplay,
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
