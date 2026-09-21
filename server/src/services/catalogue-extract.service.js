// pV2-STORE-EXTRACT-01 — website catalogue extract (Analyse → Pull).
// Mostly ASSEMBLY: the org-import guarded fetch (SSRF-safe, IP-pinned) + the
// ai.service guided-Haiku plumbing + item.service.createForOrg (items land
// PENDING). No new fetch stack, no new item-create path, no schema change —
// everything the extract captures fits existing columns (attributes JSON bag,
// external_url, images, base_price) + kind='option' child items.
//
// Shape:
//   analyse(url)          → read-only report (site shape, verdict, mapped, alsoFound, sample, productLinks)
//   pull(orgId, {urls})   → per URL: extract → createForOrg pending; dedup by _source; options as children
//
// Admin-gated + preview-first at the ROUTE (admin-orgs.js under /api/admin).

const pool = require('../db/pool');
const { guardedFetch } = require('./org-import.service');
const { analyseCatalogue, extractProduct } = require('./ai.service');
const ItemService = require('./item.service');

const MAX_TEXT_CHARS = 14000; // keep the model prompt bounded; product pages sit well under
const MAX_PULL_URLS = 40;     // per pull request (a listing can name many links)

// ── HTML → text (+ a few on-page hrefs so the AI can spot product links) ──────
function htmlToText(html, baseUrl) {
  let s = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  // Collect same-host, path-bearing hrefs before stripping tags (listing detection).
  const hrefs = [];
  const re = /href=["']([^"'#]+)["']/gi;
  let m;
  while ((m = re.exec(s)) && hrefs.length < 60) {
    const abs = absolutize(m[1], baseUrl);
    if (abs && sameHost(abs, baseUrl) && new URL(abs).pathname.length > 1 && !hrefs.includes(abs)) hrefs.push(abs);
  }
  // Collect <img> URLs — tag-strip drops src=, so the AI never saw image URLs
  // otherwise. Shared with the image FALLBACK in pull() (collectImageUrls).
  const imgs = collectImageUrls(html, baseUrl);
  const text = s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&pound;/gi, '£')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(+n); } catch { return ' '; } })
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
  const linkBlock = hrefs.length ? `\n\nLINKS ON PAGE:\n${hrefs.join('\n')}` : '';
  const imgBlock = imgs.length ? `\n\nIMAGES ON PAGE:\n${imgs.join('\n')}` : '';
  return text + linkBlock + imgBlock;
}

/** First URL of a srcset attribute (highest-priority candidate). */
function firstSrcsetUrl(tag) {
  const m = tag.match(/\bsrcset=["']([^"']+)["']/i);
  if (!m) return null;
  return (m[1].split(',')[0] || '').trim().split(/\s+/)[0] || null;
}

/** All <img> URLs on a page (src + lazy attrs + srcset first URL), absolutised.
 *  Powers the AI's "IMAGES ON PAGE" list AND the pull image FALLBACK. */
function collectImageUrls(html, baseUrl, cap = 40) {
  const s = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const imgs = [];
  const imgRe = /<img\b[^>]*>/gi;
  let im;
  while ((im = imgRe.exec(s)) && imgs.length < cap) {
    const tag = im[0];
    const cand =
      (tag.match(/\bsrc=["']([^"']+)["']/i) || [])[1]
      || (tag.match(/\bdata-src=["']([^"']+)["']/i) || [])[1]
      || (tag.match(/\bdata-lazy(?:-src)?=["']([^"']+)["']/i) || [])[1]
      || (tag.match(/\bdata-original=["']([^"']+)["']/i) || [])[1]
      || firstSrcsetUrl(tag);
    if (!cand) continue;
    const abs = absolutize(cand, baseUrl);
    if (abs && /^https?:/i.test(abs) && !imgs.includes(abs)) imgs.push(abs);
  }
  return imgs;
}

/** Skip logos/icons/sprites/placeholders when picking a fallback product photo. */
const isProductImage = (u) => !/(logo|icon|sprite|favicon|placeholder|\.svg(\?|$))/i.test(u);

function absolutize(u, base) {
  try { return new URL(u, base).toString(); } catch { return null; }
}
function sameHost(a, b) {
  try { return new URL(a).host === new URL(b).host; } catch { return false; }
}
function toNumber(v) {
  if (v == null) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

// Canonical dimension labels (aligned to item-edit's measureSuggestions) + the
// unit suffixes we fold into the value. The extract must write the STRUCTURED
// shape the editor reads (attributes.dimensions = [{label,value}]), not flat keys.
const DIM_LABELS = {
  height: 'Height', width: 'Width', depth: 'Depth', weight: 'Weight',
  seat_height: 'Seat Height', volume: 'Volume', material: 'Material',
  length: 'Length', diameter: 'Diameter', back_height: 'Back Height',
};
const UNIT_KEY = { cm: 'cm', mm: 'mm', m: 'm', kg: 'kg', g: 'g', l: 'L', ml: 'ml' };
const humanizeLabel = (s) =>
  String(s).replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\b\w/g, (c) => c.toUpperCase());

// The 5 canonical descriptive groups (fixed order + keys) — pV2-STORE-ATTRIBUTE-GROUPS-01.
const GROUP_KEYS = ['specifications', 'features', 'style', 'measurements', 'materials'];
const emptyGroups = () => ({ specifications: [], features: [], style: [], measurements: [], materials: [] });

const cleanRow = (r) => {
  if (!r || typeof r !== 'object') return null;
  const label = String(r.label ?? '').trim();
  const value = String(r.value ?? '').trim();
  return label && value ? { label, value } : null;
};

/** {rawKey,rawVal} → {label,value,unit}: canonical label where it fits (else
 *  humanized key), with a trailing _unit folded into a bare-number value
 *  (width_cm:39 → 'Width','39 cm'). Only underscore-separated units count, so
 *  'material' isn't mis-split into 'materia'+'l'. */
function toRow(rawKey, rawVal) {
  const value0 = String(rawVal).trim();
  let base = String(rawKey).toLowerCase();
  let unit = null;
  const m = base.match(/^(.+)[_-](cm|mm|kg|g|ml|l|m)$/);
  if (m) { base = m[1]; unit = UNIT_KEY[m[2]] || m[2]; }
  const label = DIM_LABELS[base] || DIM_LABELS[base.replace(/[_-]/g, '')] || humanizeLabel(base);
  const value = unit && /^[\d.]+$/.test(value0) ? `${value0} ${unit}` : value0;
  return { label, value, unit };
}

/** Heuristic group for a flat key/label (fallback only — when the AI returned a
 *  flat bag rather than the grouped shape). Mirrors the prompt's routing table. */
function classifyGroup(rawKey, label, unit) {
  const s = `${rawKey} ${label}`.toLowerCase();
  if (unit || /\b(height|width|depth|length|weight|diameter|volume|capacity|size|seat\s*height|dimension)\b/.test(s)) return 'measurements';
  if (/material|composition|fabric|wood|metal|crystal|leather|upholster/.test(s)) return 'materials';
  if (/colou?r|finish|shape|style|pattern|dial/.test(s)) return 'style';
  if (/stackable|water|movement|foldable|feature|resistant|waterproof|rechargeable|dimmable|adjustable/.test(s)) return 'features';
  return 'specifications';
}

/** Route the AI's attributes into the 5 canonical groups. Primary path: the AI
 *  returns grouped {measurements:[{label,value}], …} — normalise each. Fallback:
 *  a flat key:value bag → heuristically route each into a group (unit-folded). */
function routeAttributes(aiAttrs) {
  const groups = emptyGroups();
  if (!aiAttrs || typeof aiAttrs !== 'object') return groups;
  const grouped = GROUP_KEYS.some((k) => Array.isArray(aiAttrs[k]));
  if (grouped) {
    for (const k of GROUP_KEYS) {
      if (Array.isArray(aiAttrs[k])) groups[k] = aiAttrs[k].map(cleanRow).filter(Boolean);
    }
    return groups;
  }
  for (const [rawKey, rawVal] of Object.entries(aiAttrs)) {
    if (rawKey.startsWith('_')) continue;
    if (rawVal == null || typeof rawVal === 'object') continue;
    if (String(rawVal).trim() === '') continue;
    const row = toRow(rawKey, rawVal);
    groups[classifyGroup(rawKey, row.label, row.unit)].push({ label: row.label, value: row.value });
  }
  return groups;
}

/** The Ballpark top-level catalogue category names (the controlled vocabulary
 *  the extractor maps into). Excludes RLS test fixtures. */
async function topLevelCategoryNames() {
  const r = await pool.query(
    `SELECT name FROM categories
      WHERE namespace = 'catalogue' AND parent_id IS NULL AND deleted_at IS NULL
        AND name NOT LIKE 'rlstxn%' ORDER BY name`
  );
  return r.rows.map((x) => x.name);
}

/** The default top-level category for items we can't confidently map — so a
 *  pulled item is NEVER left without a category at volume (Liam: 100s of items).
 *  Prefers an 'Other' catalogue category; null only if the taxonomy lacks one. */
async function defaultCategoryId() {
  const r = await pool.query(
    `SELECT id FROM categories WHERE namespace = 'catalogue' AND parent_id IS NULL
       AND deleted_at IS NULL AND lower(name) = 'other' LIMIT 1`
  );
  return r.rows[0]?.id || null;
}

/** Map an AI category guess to a Ballpark top-level category id. The AI is now
 *  given our vocabulary (extractProduct), so this is usually an exact match; the
 *  child→parent fallback catches a guess that named a subcategory instead. */
async function matchCategoryId(name) {
  if (!name || !String(name).trim()) return null;
  const q = String(name).trim();
  const top = await pool.query(
    `SELECT id FROM categories WHERE namespace = 'catalogue' AND parent_id IS NULL
       AND deleted_at IS NULL AND lower(name) = lower($1) LIMIT 1`,
    [q]
  );
  if (top.rows[0]) return top.rows[0].id;
  const child = await pool.query(
    `SELECT parent_id FROM categories WHERE namespace = 'catalogue' AND parent_id IS NOT NULL
       AND deleted_at IS NULL AND lower(name) = lower($1) AND parent_id IS NOT NULL LIMIT 1`,
    [q]
  );
  return child.rows[0]?.parent_id || null;
}

// ── ANALYSE (read-only) ───────────────────────────────────────────────────────
async function analyse(url) {
  const { finalUrl, html } = await guardedFetch(url);
  const report = await analyseCatalogue(htmlToText(html, finalUrl), finalUrl);
  return { url: finalUrl, ...report };
}

// ── PULL (writes pending items) ───────────────────────────────────────────────
/** Extract each URL → createForOrg pending. Dedup by the internal _source block
 *  (sku or source_url) so a re-run adds only new products. Returns a per-URL
 *  summary. `urls` is one detail URL or many (e.g. a listing's productLinks). */
async function pull(orgId, urls) {
  const list = (Array.isArray(urls) ? urls : [urls]).filter(Boolean).slice(0, MAX_PULL_URLS);
  const batch = `extract-${new Date().toISOString().slice(0, 10)}`;
  const categoryNames = await topLevelCategoryNames(); // pass OUR vocabulary to the AI
  const results = [];
  for (const url of list) {
    try {
      const { finalUrl, html } = await guardedFetch(url);
      const p = await extractProduct(htmlToText(html, finalUrl), finalUrl, categoryNames);
      const name = (p && typeof p.name === 'string') ? p.name.trim() : '';
      if (!name) { results.push({ url: finalUrl, status: 'skipped', reason: 'no product found (not a detail page?)' }); continue; }

      const sku = p.sku ? String(p.sku).trim() : null;
      const dupe = await findExisting(orgId, finalUrl, sku);
      if (dupe) { results.push({ url: finalUrl, status: 'skipped', reason: 'already imported', itemId: dupe }); continue; }

      // attributes = the canonical groups (pV2-STORE-ATTRIBUTE-GROUPS-01) +
      // options {name,price} + price_tiers[] + the INTERNAL _source block. Each
      // descriptive group is [{label,value}]; empty groups are omitted.
      const attributes = {};
      const groups = routeAttributes(p.attributes);
      for (const k of GROUP_KEYS) { if (groups[k].length) attributes[k] = groups[k]; }
      // Selectable priced choices → options [{name, price}] (additive delta). No
      // longer child items — the option list lives on the parent item.
      const options = (Array.isArray(p.options) ? p.options : [])
        .map((o) => ({ name: String(o?.name ?? '').trim(), price: toNumber(o?.price ?? o?.upcharge) || 0 }))
        .filter((o) => o.name);
      if (options.length) attributes.options = options;
      if (Array.isArray(p.priceTiers) && p.priceTiers.length) {
        // Canonical tier shape is { min, max, price } (item-edit + line-pricing).
        // Sort by lower threshold and DERIVE each upper bound from the next tier's
        // min − 1 (last tier open-ended) so ranges never overlap, even if the model
        // returned min=1 for every tier or omitted max.
        const tiers = p.priceTiers
          .map((t) => ({ min: toNumber(t.min ?? t.minQty), price: toNumber(t.price) }))
          .filter((t) => t.min != null && t.price != null)
          .sort((a, b) => a.min - b.min);
        tiers.forEach((t, i) => { t.max = i < tiers.length - 1 ? tiers[i + 1].min - 1 : null; });
        if (tiers.length) attributes.price_tiers = tiers;
      }
      // Internal source-identity block (_ prefix → item view/editor skip it).
      // The PRIMARY source URL lives in the dedicated items.external_url column
      // (below) — the dedup/delta key; the other stable ids live here.
      attributes._source = pruneNull({
        sku, product_id: p.product_id ? String(p.product_id).trim() : null,
        supplier_ref: p.supplier_ref ? String(p.supplier_ref).trim() : null,
        extracted_at: new Date().toISOString(), batch,
      });

      let images = (Array.isArray(p.images) ? p.images : [])
        .map((u) => absolutize(u, finalUrl)).filter(Boolean)
        .map((u, i) => ({ url: u, is_hero: i === 0 }));
      // Image extraction is non-deterministic — when the AI returned none, fall
      // back to the first product-looking image on the page so the item lands
      // with a photo instead of the placeholder (Liam, v2.531).
      if (!images.length) {
        const cand = collectImageUrls(html, finalUrl).filter(isProductImage);
        if (cand.length) images = [{ url: cand[0], is_hero: true }];
      }

      const item = await ItemService.createForOrg({
        data: {
          name,
          base_price: toNumber(p.base_price),
          description: typeof p.description === 'string' ? p.description.trim() : null,
          unit: p.unit || 'each',
          // Map to REAL columns when the model found them (homes exist in the model);
          // only spec key:values with no column fall to the attributes bag.
          install_description: typeof p.install_description === 'string' ? p.install_description.trim() : null,
          install_cost: toNumber(p.install_cost),
          lead_time_days: toNumber(p.lead_time_days),
          external_url: finalUrl, // PRIMARY source URL — dedup/delta key
          // Never null: map to our vocabulary, else the 'Other' default. The
          // auto-classifier refines this + picks a subcategory on create.
          category_id: (await matchCategoryId(p.category)) || (await defaultCategoryId()),
          attributes,
          images,
        },
        orgId,
        defaultStatus: 'pending',
      });

      results.push({ url: finalUrl, status: 'created', itemId: item.id, name: item.name, optionCount: options.length });
    } catch (err) {
      results.push({ url, status: 'error', reason: err.message });
    }
  }
  const created = results.filter((r) => r.status === 'created').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'error').length;
  return { created, skipped, failed, results };
}

/** Existing item for this org matching the source URL (external_url, the primary
 *  key) or the supplier SKU (_source.sku). The dedup/delta key. */
async function findExisting(orgId, sourceUrl, sku) {
  const clauses = [`external_url = $2`];
  const params = [orgId, sourceUrl];
  if (sku) { params.push(sku); clauses.push(`attributes->'_source'->>'sku' = $${params.length}`); }
  const r = await pool.query(
    `SELECT id FROM items WHERE org_id = $1 AND deleted_at IS NULL AND (${clauses.join(' OR ')}) LIMIT 1`,
    params
  );
  return r.rows[0]?.id || null;
}

function pruneNull(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v != null && v !== '') out[k] = v;
  return out;
}

module.exports = { analyse, pull, _internals: { htmlToText, matchCategoryId, toNumber, routeAttributes } };
