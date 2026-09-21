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
  const text = s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&pound;/gi, '£')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(+n); } catch { return ' '; } })
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_TEXT_CHARS);
  const linkBlock = hrefs.length ? `\n\nLINKS ON PAGE:\n${hrefs.join('\n')}` : '';
  return text + linkBlock;
}

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

/** Map an AI category guess to a Ballpark top-level catalogue category by name. */
async function matchCategoryId(name) {
  if (!name || !String(name).trim()) return null;
  const r = await pool.query(
    `SELECT id FROM categories
      WHERE namespace = 'catalogue' AND parent_id IS NULL AND deleted_at IS NULL
        AND lower(name) = lower($1) LIMIT 1`,
    [String(name).trim()]
  );
  return r.rows[0]?.id || null;
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
  const results = [];
  for (const url of list) {
    try {
      const { finalUrl, html } = await guardedFetch(url);
      const p = await extractProduct(htmlToText(html, finalUrl), finalUrl);
      const name = (p && typeof p.name === 'string') ? p.name.trim() : '';
      if (!name) { results.push({ url: finalUrl, status: 'skipped', reason: 'no product found (not a detail page?)' }); continue; }

      const sku = p.sku ? String(p.sku).trim() : null;
      const dupe = await findExisting(orgId, finalUrl, sku);
      if (dupe) { results.push({ url: finalUrl, status: 'skipped', reason: 'already imported', itemId: dupe }); continue; }

      // attributes = flat specs + price_tiers + the INTERNAL _source block.
      const attributes = { ...(p.attributes && typeof p.attributes === 'object' ? p.attributes : {}) };
      if (Array.isArray(p.priceTiers) && p.priceTiers.length) {
        attributes.price_tiers = p.priceTiers
          .map((t) => ({ minQty: toNumber(t.minQty), price: toNumber(t.price) }))
          .filter((t) => t.minQty != null && t.price != null);
      }
      // Internal source-identity block (_ prefix → item view/editor skip it).
      // The PRIMARY source URL lives in the dedicated items.external_url column
      // (below) — the dedup/delta key; the other stable ids live here.
      attributes._source = pruneNull({
        sku, product_id: p.product_id ? String(p.product_id).trim() : null,
        supplier_ref: p.supplier_ref ? String(p.supplier_ref).trim() : null,
        extracted_at: new Date().toISOString(), batch,
      });

      const images = (Array.isArray(p.images) ? p.images : [])
        .map((u) => absolutize(u, finalUrl)).filter(Boolean)
        .map((u, i) => ({ url: u, is_hero: i === 0 }));

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
          category_id: await matchCategoryId(p.category),
          attributes,
          images,
        },
        orgId,
        defaultStatus: 'pending',
      });

      // Single-group options → hidden kind='option' child items (0 or upcharge).
      let optionCount = 0;
      for (const opt of Array.isArray(p.options) ? p.options : []) {
        const optName = opt && typeof opt.name === 'string' ? opt.name.trim() : '';
        if (!optName) continue;
        await ItemService.create({
          org_id: orgId, parent_item_id: item.id, kind: 'option',
          name: optName, base_price: toNumber(opt.upcharge) || 0, unit: 'each',
          approval_status: 'approved', is_active: true,
        });
        optionCount++;
      }

      results.push({ url: finalUrl, status: 'created', itemId: item.id, name: item.name, optionCount });
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

module.exports = { analyse, pull, _internals: { htmlToText, matchCategoryId, toNumber } };
