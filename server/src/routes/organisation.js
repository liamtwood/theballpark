// pV2 Profile — the signed-in org's own profile. Mounted on the GATED v2
// router (`v2.use('/organisation', …)`): GET inherits the router-level
// authenticate + requireActiveMembership (any active member reads their own
// org); PUT additionally requires org.manage_billing (org admins — it edits
// the financial defaults). Org identity is ALWAYS req.user.org_id.
// Distinct path from v1's legacy ungated /api/org (getCurrentAgency era).

const router = require('express').Router();
const { z } = require('zod');
const pool = require('../db/pool');
const { requireActiveMembership } = require('../middleware/require-active-membership');
const { OrganisationUpdateSchema } = require('../schemas/organisation.schema');

/** Shared projection — explicit columns, camelCase out. */
const SELECT = `SELECT id, name, description, address, city, country, email, phone, ref_prefix, ref_counter,
       default_vat_pct, default_margin_pct, default_contingency_pct, default_currency,
       logo_url, cover_image_url, images, terms_pdf_url
  FROM orgs WHERE id = $1 AND deleted_at IS NULL`;

function toProfile(row) {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
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
    // pV2-MEDIA-01d — branding.
    logoUrl: row.logo_url ?? null,
    coverImageUrl: row.cover_image_url ?? null,
    images: Array.isArray(row.images) ? row.images : [],
    // pV2-BUILDUP-04 — standard T&C PDF (SOW Annex A).
    termsPdfUrl: row.terms_pdf_url ?? null,
  };
}

// GET /api/organisation — the caller's own org profile.
router.get('/', async (req, res, next) => {
  try {
    const r = await pool.query(SELECT, [req.user.org_id]);
    if (!r.rows.length) return res.status(404).json({ error: 'Organisation not found' });
    res.json(toProfile(r.rows[0]));
  } catch (err) { next(err); }
});

// PUT /api/organisation — org admins update their own org. Partial updates
// allowed (only provided fields change); single UPDATE statement.
router.put('/', requireActiveMembership('org.manage_billing'), async (req, res, next) => {
  try {
    const parsed = OrganisationUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Invalid input',
        details: z.flattenError(parsed.error).fieldErrors,
      });
    }
    const p = parsed.data;
    const map = {
      name: p.name,
      description: p.description === '' ? null : p.description,
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
      // pV2-MEDIA-01d — branding URLs (nullable to clear).
      logo_url: p.logoUrl,
      cover_image_url: p.coverImageUrl,
      // pV2-BUILDUP-04 — standard T&C PDF (nullable to clear).
      terms_pdf_url: p.termsPdfUrl,
    };
    const sets = [];
    const vals = [];
    for (const [col, val] of Object.entries(map)) {
      if (val !== undefined) {
        vals.push(val);
        sets.push(`${col} = $${vals.length}`);
      }
    }
    // images is jsonb — serialize + cast (pg would bind a JS array as a PG array).
    if (p.images !== undefined) {
      vals.push(JSON.stringify(p.images));
      sets.push(`images = $${vals.length}::jsonb`);
    }
    if (!sets.length) return res.status(400).json({ error: 'No fields to update' });
    vals.push(req.user.org_id);
    const r = await pool.query(
      `UPDATE orgs SET ${sets.join(', ')}, updated_at = NOW()
        WHERE id = $${vals.length} AND deleted_at IS NULL
        RETURNING id`,
      vals
    );
    if (!r.rows.length) return res.status(404).json({ error: 'Organisation not found' });
    const fresh = await pool.query(SELECT, [req.user.org_id]);
    res.json(toProfile(fresh.rows[0]));
  } catch (err) { next(err); }
});

module.exports = router;
