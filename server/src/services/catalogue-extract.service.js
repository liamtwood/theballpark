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
const { analyseCatalogue, extractProduct, classifyGroup: classifyGroupToCategory } = require('./ai.service');
const ItemService = require('./item.service');

const MAX_TEXT_CHARS = 14000; // keep the model prompt bounded; product pages sit well under
const MAX_PULL_URLS = 100;    // per pull request — small catalogues (<100 items) in one go
const CRAWL_MAX_PAGES = 250;  // bounded BFS ceiling — covers a whole small/mid catalogue; a
                              // very large one needs pagination/concurrency (future).
// Is a page a PRODUCT (a leaf to pull) vs a listing/collection? No single signal is
// universal across platforms, so combine (deterministic, AI-free):
//  • og:type = "product"        → yes (Shopify/Woo product page)
//  • og:type = "product.group"  → NO  (Shopify collection — short-circuit)
//  • schema.org Product + Offer → yes (Yahire etc., whose product og:type is "website")
// Verified: Yahire products (JSON-LD path) + Shopify products (og:type) both pass;
// Shopify collections + .atom/.oembed feeds no longer false-positive.
function isProductHtml(html) {
  const s = String(html || '');
  const og = (
    s.match(/property=["']og:type["'][^>]*content=["']([^"']+)["']/i) ||
    s.match(/content=["']([^"']+)["'][^>]*property=["']og:type["']/i) || []
  )[1] || '';
  if (/^\s*product\s*$/i.test(og)) return true;
  if (/product\.group/i.test(og)) return false;
  return /"@type"\s*:\s*"Product"/.test(s) && /"@type"\s*:\s*"Offer"/.test(s);
}
// Skip assets + non-catalogue pages when crawling for item pages.
const CRAWL_SKIP = /(cart|checkout|basket|account|login|register|sign-?in|contact|about|privacy|terms|cookie|blog|news|faqs?|wishlist|delivery|returns|policy|gallery|inspired|story|trade-with|my-quote|\.pdf|\.jpe?g|\.png|\.webp|\.svg|\.css|\.js|\.woff2?|\.ico|webmanifest|\.atom|\.oembed|\.rss|\.json|\/feed)/i;
const normUrl = (u) => String(u).split('#')[0].replace(/\/$/, '');

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

/** Product images declared in JSON-LD (schema.org Product.image). On many
 *  e-commerce pages this is the authoritative hero set — and often the ONLY place
 *  the real product photo appears, because the <img> gallery is lazy-loaded and its
 *  static src= is a placeholder (e.g. Yahire: product.webp ×3, real images in ld+json).
 *  Walks every ld+json block, collecting image[] only from Product-typed nodes (so we
 *  skip Organization/WebSite slideshow banners). */
function collectJsonLdImages(html, baseUrl, cap = 20) {
  const out = [];
  const pushImg = (img) => {
    for (const v of (Array.isArray(img) ? img : [img])) {
      const u = typeof v === 'string' ? v : (v && typeof v === 'object' ? (v.url || v.contentUrl) : null);
      const abs = u ? absolutize(String(u), baseUrl) : null;
      if (abs && /^https?:/i.test(abs) && !out.includes(abs) && out.length < cap) out.push(abs);
    }
  };
  const walk = (node) => {
    if (!node || typeof node !== 'object') return;
    if (Array.isArray(node)) { node.forEach(walk); return; }
    const t = node['@type'];
    const isProduct = Array.isArray(t) ? t.some((x) => /product/i.test(String(x))) : /product/i.test(String(t || ''));
    if (isProduct && node.image) pushImg(node.image);
    for (const k of Object.keys(node)) { if (k !== 'image') walk(node[k]); }
  };
  for (const b of String(html || '').matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try { walk(JSON.parse(b[1].trim())); } catch { /* skip malformed block */ }
  }
  return out;
}

/** All product image URLs on a page — JSON-LD Product images FIRST (authoritative
 *  hero), then <img> URLs (src + lazy attrs + srcset first URL), absolutised.
 *  Powers the AI's "IMAGES ON PAGE" list AND the pull image FALLBACK. */
function collectImageUrls(html, baseUrl, cap = 40) {
  const s = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ');
  const imgs = collectJsonLdImages(html, baseUrl); // authoritative product photos lead
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
/** Tolerant name compare (case + whitespace) for cat/subcat matching. */
const norm = (s) => String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');

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

/** The real marketplace taxonomy for Prepare + the client's cat/subcat dropdowns:
 *  [{ id, name, subcats:[{id,name}] }], excluding the feedback namespace + RLS
 *  test fixtures. Ordered by sort_order then name. */
async function marketplaceCategoryTree() {
  const r = await pool.query(
    `SELECT id, name, parent_id, NULLIF(TRIM(COALESCE(description,'')),'') AS description
       FROM categories
      WHERE namespace = 'catalogue' AND deleted_at IS NULL AND name NOT LIKE 'rlstxn%'
      ORDER BY sort_order ASC, name ASC`
  );
  const tops = r.rows.filter((c) => !c.parent_id);
  return tops.map((t) => ({
    id: t.id, name: t.name, description: t.description || null,
    subcats: r.rows.filter((c) => c.parent_id === t.id).map((c) => ({ id: c.id, name: c.name, description: c.description || null })),
  }));
}

/** Supplier group key from a product URL — the PARENT path (all segments EXCEPT the
 *  product slug), so the supplier's own hierarchy is retained at whatever depth:
 *  /gazebo-hire/3m-gazebo → "gazebo-hire";
 *  /catering-equipment-hire/cutlery-hire/fork → "catering-equipment-hire/cutlery-hire".
 *  The full path lives in external_url, so nothing is lost. ONE key per supplier group. */
function groupKeyOf(u) {
  try {
    const segs = new URL(u).pathname.split('/').filter(Boolean);
    // Shopify/Woo flat product URL (/products/<handle> or /collections/<c>/products/<handle>):
    // the supplier's grouping is the COLLECTION, not the literal "products" segment.
    const pi = segs.indexOf('products');
    if (pi >= 0) {
      const before = segs.slice(0, pi).filter((s) => !['collections', 'collection', 'shop', 'store'].includes(s));
      return before.length ? before[before.length - 1] : 'products';
    }
    // Path-hierarchy sites (Yahire): parent path = all segments except the product slug.
    return (segs.length > 1 ? segs.slice(0, -1) : segs).join('/') || 'other';
  } catch { return 'other'; }
}
/** The supplier's category label for a group key — its LEAF segment humanised
 *  ("catering-equipment-hire/cutlery-hire" → "Cutlery Hire"). */
const groupLabel = (key) => humanizeLabel(String(key).split('/').filter(Boolean).pop() || key);
/** The full supplier path humanised, for AI context ("Catering Equipment Hire > Cutlery Hire"). */
const groupPathLabel = (key) => String(key).split('/').filter(Boolean).map(humanizeLabel).join(' > ') || humanizeLabel(key);

/** PREPARE (Liam's step 2): for each SELECTED group, map the supplier's category
 *  → a Ballpark category + subcategory (existing or a proposed NEW one). One cheap
 *  AI call per group — we only classify what we're about to load. Returns the real
 *  taxonomy tree (for the dropdowns) + a suggestion per group. `groups` = [{ key,
 *  sample }] where sample is a representative product name/slug. */
async function prepare(groups) {
  const tree = await marketplaceCategoryTree();
  const treeForAi = tree.map((c) => ({ name: c.name, description: c.description, subcats: c.subcats.map((s) => ({ name: s.name, description: s.description })) }));
  const list = Array.isArray(groups) ? groups : [];
  const out = [];
  for (const g of list) {
    const key = String(g?.key ?? '').trim();
    if (!key) continue;
    const label = groupLabel(key);
    const pathLabel = groupPathLabel(key); // full supplier path → richer AI context
    let sug = { category: null, subcategory: null, isNew: false, confidence: 0 };
    try { sug = await classifyGroupToCategory(pathLabel, g?.sample || label, treeForAi); } catch { /* keep default */ }
    // Resolve the suggested category to a real id (else 'Other').
    const cat = tree.find((c) => norm(c.name) === norm(sug.category)) || tree.find((c) => norm(c.name) === 'other') || null;
    let subId = null, subName = sug.subcategory ? String(sug.subcategory).trim() : null, isNew = !!sug.isNew;
    if (cat && subName) {
      const existing = cat.subcats.find((s) => norm(s.name) === norm(subName));
      if (existing) { subId = existing.id; subName = existing.name; isNew = false; }
      else { isNew = true; } // no close existing → propose new under this cat
    }
    out.push({
      key, label, path: pathLabel,
      categoryId: cat?.id || null, categoryName: cat?.name || null,
      subcategoryId: subId, subcategoryName: subName, isNew,
      confidence: sug.confidence ?? 0,
    });
  }
  return { categories: tree, groups: out };
}

/** Resolve a group's mapping row to concrete { categoryId, subcategoryId },
 *  CREATING a new subcategory under the category when the row asks for one. Cached
 *  by category|name within a pull so we create each new subcat at most once. */
async function resolveMappingRow(row, cache) {
  if (!row || !row.categoryId) return { categoryId: null, subcategoryId: null };
  let subcategoryId = row.subcategoryId || null;
  const wantNew = !subcategoryId && row.subcategoryName && (row.isNew || row.createSubcategory);
  if (wantNew) {
    const ck = `${row.categoryId}|${norm(row.subcategoryName)}`;
    if (cache.has(ck)) subcategoryId = cache.get(ck);
    else {
      // Re-check it wasn't created by an earlier run, then insert (mirrors a curated
      // subcat: catalogue namespace, level 1, enabled). Only NOT-NULL col is name.
      const found = await pool.query(
        `SELECT id FROM categories WHERE parent_id = $1 AND deleted_at IS NULL
           AND lower(name) = lower($2) LIMIT 1`, [row.categoryId, row.subcategoryName]);
      if (found.rows[0]) subcategoryId = found.rows[0].id;
      else {
        const ins = await pool.query(
          `INSERT INTO categories (name, parent_id, namespace, model, level, is_active, enabled, sort_order)
             VALUES ($1, $2, 'catalogue', 'A', 1, false, true, 999) RETURNING id`,
          [row.subcategoryName, row.categoryId]);
        subcategoryId = ins.rows[0].id;
      }
      cache.set(ck, subcategoryId);
    }
  }
  return { categoryId: row.categoryId, subcategoryId };
}

// ── Site crawl (bounded BFS) — discovers same-host content URLs. `prefix` (a
//    pathname like "/gazebo-hire") scopes the crawl to ONE section so a category
//    URL can be processed on its own (Liam) instead of the whole site. ────────────
async function crawlSite(seedUrl, maxPages = CRAWL_MAX_PAGES, prefix = null) {
  const home = normUrl(seedUrl);
  const host = new URL(home).host;
  const sameHost = (u) => { try { return new URL(u).host === host; } catch { return false; } };
  const inScope = (path) => !prefix || path === prefix || path.startsWith(prefix + '/');
  const visited = new Set();
  const discovered = new Set();
  const products = new Set(); // leaf product pages (schema.org Product) — the task list
  const queue = [home];
  let fetched = 0;
  while (queue.length && fetched < maxPages) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    let html;
    try { ({ html } = await guardedFetch(url)); fetched++; } catch { continue; }
    if (isProductHtml(html)) products.add(url); // a real product, at whatever depth
    for (const m of html.matchAll(/href=["']([^"'#]+)["']/gi)) {
      let abs;
      try { abs = normUrl(new URL(m[1], url).toString()); } catch { continue; }
      if (!sameHost(abs)) continue;
      const path = new URL(abs).pathname;
      if (path.length <= 1 || !inScope(path)) continue;
      if (CRAWL_SKIP.test(abs) || abs.includes('%7B') || abs.includes('${')) continue;
      discovered.add(abs);
      if (!visited.has(abs) && queue.length + visited.size < maxPages * 4) queue.push(abs);
    }
  }
  return { pagesFetched: fetched, urls: [...discovered], products: [...products] };
}

const isHomepage = (url) => { try { return new URL(url).pathname.replace(/\/$/, '') === ''; } catch { return false; } };
/** Path depth: homepage 0, section root ("/gazebo-hire") 1, product ("/gazebo-hire/3m") 2+. */
const pathDepth = (url) => { try { return new URL(url).pathname.split('/').filter(Boolean).length; } catch { return 0; } };

/** From the crawl's URLs, pick the ITEM pages heuristically: the /category/product
 *  pattern — depth-2 paths whose top segment is a category root (a segment that has
 *  multiple children). Deterministic + free; a good first pass for small catalogues
 *  (Liam: try a few, refine). Query-string URLs (filters/sorts) are dropped. */
function pickItemUrls(urls) {
  const clean = urls.filter((u) => !u.includes('?'));
  const parts = (u) => { try { return new URL(u).pathname.split('/').filter(Boolean); } catch { return []; } };
  const rootsWithChildren = new Set(clean.map(parts).filter((p) => p.length >= 2).map((p) => p[0]));
  const items = clean.filter((u) => { const p = parts(u); return p.length === 2 && rootsWithChildren.has(p[0]); });
  return [...new Set(items)];
}

// ── ANALYSE (read-only) ───────────────────────────────────────────────────────
// Crawl scoped to the URL's own path — homepage → whole site; a section/category
// ("/catering-equipment-hire") → just that section (any depth below it); a product
// URL → just itself. Products are detected by the Product-JSON-LD signal (AI-free,
// works at any depth), so listing pages are followed for links but never pulled.
// The task list is grouped by the supplier's URL hierarchy in the panel.
async function analyse(url) {
  const path = isHomepage(url) ? null : new URL(url).pathname.replace(/\/$/, '');
  const { pagesFetched, urls, products } = await crawlSite(url, CRAWL_MAX_PAGES, path);
  // Fallback for sites without Product JSON-LD: the old depth-2 heuristic.
  const productUrls = products.length ? products : pickItemUrls(urls);
  const where = path ? `the ${groupLabel(path.replace(/^\//, ''))} section` : `${pagesFetched} pages`;
  const capped = pagesFetched >= CRAWL_MAX_PAGES ? ` (crawl cap ${CRAWL_MAX_PAGES} reached — narrow to a section for the rest)` : '';
  return {
    url: normUrl(url),
    pageShape: 'site',
    pullable: productUrls.length > 0,
    verdict: productUrls.length
      ? `Crawled ${where} (${pagesFetched} pages) and found ${productUrls.length} product pages to pull.${capped}`
      : `Crawled ${where} (${pagesFetched} pages) but found no product pages — try a category or product URL.`,
    mapped: { itemCount: productUrls.length },
    alsoFound: [],
    sample: null,
    productLinks: productUrls,
    crawledPages: pagesFetched,
    discovered: urls.length,
  };
}

// ── PULL (writes pending items) ───────────────────────────────────────────────
/** Extract each URL → createForOrg pending. Dedup by the internal _source block
 *  (sku or source_url) so a re-run adds only new products. Returns a per-URL
 *  summary. `urls` is one detail URL or many (e.g. a listing's productLinks). */
/** The stable product handle from a URL — the slug after /products/, else the last
 *  segment. Identical across collections, so it's the cross-collection dedup key. */
function productHandle(u) {
  try {
    const segs = new URL(u).pathname.split('/').filter(Boolean);
    const pi = segs.indexOf('products');
    return pi >= 0 ? (segs[pi + 1] || segs[segs.length - 1]) : segs[segs.length - 1];
  } catch { return u; }
}
/** 0 for generic/utility collections (all/front-page/products), 1 for a real one —
 *  so dedup keeps the specific collection (better group + cat/subcat) over "all". */
const groupSpecificity = (u) => (['all', 'front-page', 'frontpage', 'products', 'other'].includes(groupKeyOf(u)) ? 0 : 1);
/** Dedup a URL list by product handle, keeping the most specific collection URL —
 *  a Shopify product sits in "all" AND its real collection at different URLs. */
function dedupeByHandle(urls) {
  const best = new Map();
  for (const u of urls) {
    const h = productHandle(u);
    const cur = best.get(h);
    if (!cur || groupSpecificity(u) > groupSpecificity(cur)) best.set(h, u);
  }
  return [...best.values()];
}

async function pull(orgId, urls, opts = {}) {
  // Dedup the selection by product handle FIRST (drops "all"/"front-page" copies of a
  // product that's also in a real collection), then cap — so the cap isn't spent on dups.
  const list = dedupeByHandle((Array.isArray(urls) ? urls : [urls]).filter(Boolean)).slice(0, MAX_PULL_URLS);
  // Pull mode (Liam): 'review' = lean triage set (name/description/price/one image)
  // for marketplace vetting; 'full' = everything mappable, run after the supplier
  // contracts. Both still capture external_url + _source (dedup) and the gap list.
  const review = opts.mode === 'review';
  // Prepare-step mapping (Liam's step 2): { groupKey → {categoryId, subcategoryId?,
  // subcategoryName?, isNew?} }. When present for a group, it is AUTHORITATIVE — the
  // item gets that cat/subcat and the per-item AI classifier is skipped.
  const mapping = opts.mapping && typeof opts.mapping === 'object' ? opts.mapping : {};
  const subcatCache = new Map();
  const batch = `extract-${new Date().toISOString().slice(0, 10)}`;
  const categoryNames = await topLevelCategoryNames(); // pass OUR vocabulary to the AI
  const results = [];
  const gapMap = new Map(); // "kind|label" → { label, kind, count, example }
  const seenIds = new Set(); // in-pull dedup by the stable vendor identity (sku/product id)
  for (const url of list) {
    try {
      const groupRow = mapping[groupKeyOf(url)] || null; // group keyed off the selected URL
      const { finalUrl, html } = await guardedFetch(url);
      const p = await extractProduct(htmlToText(html, finalUrl), finalUrl, categoryNames);
      const name = (p && typeof p.name === 'string') ? p.name.trim() : '';
      if (!name) { results.push({ url: finalUrl, status: 'skipped', reason: 'no product found (not a detail page?)' }); continue; }

      // Stable vendor identity, parsed deterministically from structured data (not the
      // AI): the SKU/id is the vendor's + agent's key AND the reliable dedup key.
      const identity = extractIdentity(html, finalUrl);
      const sku = identity.sku || (p.sku ? String(p.sku).trim() : null);
      const productId = identity.productId;
      const idKey = productId || sku || identity.handle;
      if (idKey && seenIds.has(idKey)) { results.push({ url: finalUrl, status: 'skipped', reason: 'duplicate in selection' }); continue; }
      if (idKey) seenIds.add(idKey);
      const dupe = await findExisting(orgId, finalUrl, sku, productId);
      if (dupe) { results.push({ url: finalUrl, status: 'skipped', reason: 'already imported', itemId: dupe }); continue; }

      // Gap report: data present on the page with no home in our model. Aggregated
      // across the imported items → "couldn't store yet: X (12 items)". Free — it
      // rides on the extract call we already made. (See noHome in PULL_SYSTEM.)
      for (const g of (Array.isArray(p.noHome) ? p.noHome : [])) {
        const label = String(g?.label ?? '').trim();
        if (!label) continue;
        const kind = String(g?.kind ?? 'other').trim().toLowerCase() || 'other';
        const key = `${kind}|${label.toLowerCase()}`;
        const hit = gapMap.get(key) || { label, kind, count: 0, example: String(g?.value ?? '').trim() || null };
        hit.count += 1;
        gapMap.set(key, hit);
      }

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
      const supplierRef = p.supplier_ref ? String(p.supplier_ref).trim() : null;
      attributes._source = pruneNull({
        sku, // deterministic vendor SKU (structured data), else the AI's guess
        product_id: productId || (p.product_id ? String(p.product_id).trim() : null),
        handle: identity.handle,
        supplier_ref: supplierRef,
        extracted_at: new Date().toISOString(), batch,
      });
      // Visible "Identifiers" group — all ids we found (a product may carry several).
      const idRows = [...(identity.ids || [])];
      if (supplierRef && !idRows.some((r) => r.value === supplierRef)) idRows.push({ label: 'Supplier Ref', value: supplierRef });
      if (idRows.length) attributes.ids = idRows;

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

      // Review mode: keep the lean vetting set only. attributes narrows to the
      // internal _source block (so re-run dedup still works); images to the hero;
      // install/lead-time dropped. base_price + category stay — needed to review.
      // Review keeps the lean set, but ALWAYS carries _source + the ids group (the
      // vendor/agent key must survive even a triage load).
      const reviewAttrs = {};
      if (attributes._source) reviewAttrs._source = attributes._source;
      if (attributes.ids) reviewAttrs.ids = attributes.ids;
      // Category + subcategory: if this group has a Prepare mapping, it's authoritative
      // (all items in the supplier's group get the SAME cat/subcat, creating a new
      // subcat if the mapping asked for one) and we skip the per-item AI classifier.
      // No mapping → fall back to the AI's per-item guess + the default 'Other'.
      let categoryId, subcategoryId = null, skipClassify = false;
      if (groupRow && groupRow.categoryId) {
        const resolved = await resolveMappingRow(groupRow, subcatCache);
        categoryId = resolved.categoryId || (await defaultCategoryId());
        subcategoryId = resolved.subcategoryId;
        skipClassify = true;
      } else {
        categoryId = (await matchCategoryId(p.category)) || (await defaultCategoryId());
      }
      const item = await ItemService.createForOrg({
        data: {
          name,
          base_price: toNumber(p.base_price),
          description: typeof p.description === 'string' ? p.description.trim() : null,
          unit: p.unit || 'each',
          // Map to REAL columns when the model found them (homes exist in the model);
          // only spec key:values with no column fall to the attributes bag.
          install_description: review ? null : (typeof p.install_description === 'string' ? p.install_description.trim() : null),
          install_cost: review ? null : toNumber(p.install_cost),
          lead_time_days: review ? null : toNumber(p.lead_time_days),
          external_url: finalUrl, // PRIMARY source URL — dedup/delta key
          category_id: categoryId,
          subcategory_id: subcategoryId,
          attributes: review ? reviewAttrs : attributes,
          images: review ? images.slice(0, 1) : images,
        },
        orgId,
        defaultStatus: 'pending',
        skipClassify,
      });

      results.push({ url: finalUrl, status: 'created', itemId: item.id, name: item.name, optionCount: review ? 0 : options.length });
    } catch (err) {
      results.push({ url, status: 'error', reason: err.message });
    }
  }
  const created = results.filter((r) => r.status === 'created').length;
  const skipped = results.filter((r) => r.status === 'skipped').length;
  const failed = results.filter((r) => r.status === 'error').length;
  const gaps = [...gapMap.values()].sort((a, b) => b.count - a.count);
  return { created, skipped, failed, mode: review ? 'review' : 'full', gaps, results };
}

/** Existing item for this org matching the source URL (external_url, the primary
 *  key) or the supplier SKU (_source.sku). The dedup/delta key. */
async function findExisting(orgId, sourceUrl, sku, productId) {
  const clauses = [`external_url = $2`];
  const params = [orgId, sourceUrl];
  if (sku) { params.push(sku); clauses.push(`attributes->'_source'->>'sku' = $${params.length}`); }
  if (productId) { params.push(String(productId)); clauses.push(`attributes->'_source'->>'product_id' = $${params.length}`); }
  const r = await pool.query(
    `SELECT id FROM items WHERE org_id = $1 AND deleted_at IS NULL AND (${clauses.join(' OR ')}) LIMIT 1`,
    params
  );
  return r.rows[0]?.id || null;
}

/** Deterministically pull a STABLE vendor identity from a product page's structured
 *  data (the SKU/id lives in <script> JSON we strip before the AI, so parse it here):
 *   • JSON-LD Product.sku / offers.sku (Yahire → 222/404)
 *   • Shopify page JSON: product "id" + a variant "sku" (faux-mimosa → 8108933480680/10753)
 *  Falls back to the product handle. SKU is the vendor's + agent's key and the dedup key. */
function extractIdentity(html, url) {
  const s = String(html || '');
  let sku = null, productId = null, mpn = null, gtin = null;
  for (const b of s.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const j = JSON.parse(b[1].trim());
      const nodes = Array.isArray(j) ? j : (j['@graph'] || [j]);
      for (const n of nodes) {
        const t = n && n['@type'];
        if (!t || !(Array.isArray(t) ? t : [t]).some((x) => /product/i.test(String(x)))) continue;
        const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
        sku = sku || n.sku || offer?.sku || null;
        productId = productId || n.productID || null;
        mpn = mpn || n.mpn || offer?.mpn || null;
        gtin = gtin || n.gtin13 || n.gtin12 || n.gtin || n.gtin14 || null;
      }
    } catch { /* skip malformed */ }
  }
  // Shopify (no JSON-LD Product): the embedded product JSON carries id + variant sku + barcode.
  if (!productId) productId = (s.match(/"product"\s*:\s*\{[\s\S]{0,400}?"id"\s*:\s*(\d{6,})/) || s.match(/\bproductId["']?\s*[:=]\s*["']?(\d{6,})/i) || [])[1] || null;
  if (!sku) sku = (s.match(/"sku"\s*:\s*"([^"]+)"/i) || [])[1] || null;
  if (!gtin) gtin = (s.match(/"barcode"\s*:\s*"([^"]+)"/i) || [])[1] || null;
  const clean = (v) => (v == null || v === '' ? null : String(v).trim());
  [sku, productId, mpn, gtin] = [clean(sku), clean(productId), clean(mpn), clean(gtin)];
  // The visible "Identifiers" group — every distinct id we found, labelled (Liam: a
  // product may carry several; collect them all, never lose one).
  const ids = [];
  const add = (label, value) => { if (value && !ids.some((r) => r.value === value)) ids.push({ label, value }); };
  add('SKU', sku); add('MPN', mpn); add('GTIN', gtin); add('Product ID', productId);
  return { sku, productId, mpn, gtin, handle: productHandle(url), ids };
}

function pruneNull(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) if (v != null && v !== '') out[k] = v;
  return out;
}

module.exports = { analyse, prepare, pull, _internals: { htmlToText, matchCategoryId, toNumber, routeAttributes, collectImageUrls, collectJsonLdImages, marketplaceCategoryTree, groupKeyOf, dedupeByHandle, productHandle, extractIdentity } };
