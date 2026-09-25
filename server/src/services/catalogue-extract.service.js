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
const { als } = require('../db/request-context');
const { guardedFetch } = require('./org-import.service');
const { analyseCatalogue, extractProduct, classifyGroup: classifyGroupToCategory } = require('./ai.service');
const ItemService = require('./item.service');
const { normUrl, htmlToPlain } = require('./catalogue-extract/util');
// Platform profiles (pV2-STORE-PROFILES-01) — structured, crawl-free reads for sites
// that expose an API (WooCommerce Store API / WordPress REST). detectProfile picks one;
// the generic crawler below handles everything else.
const {
  detectProfile, analyseWoo, analyseWordpress,
  wooGetJson, wooPrice, wooPrimaryCategory, wpFetchProduct,
} = require('./catalogue-extract/profiles');

const MAX_TEXT_CHARS = 14000; // keep the model prompt bounded; product pages sit well under
const MAX_PULL_URLS = 500;    // per pull request — matches the route's 500-URL cap; a whole
                              // mid-size catalogue in one background job (runs sequentially + cancellable)
const CRAWL_MAX_PAGES = 250;  // bounded BFS ceiling — covers a whole small/mid catalogue; a
                              // very large one needs pagination/concurrency (future).
// Claude Haiku 4.5 rate (USD per token, verified 2026-09-23: $1/MTok in, $5/MTok out).
// Single source of truth — update here if the model or its price changes.
const HAIKU_USD_PER_INPUT_TOKEN = 1 / 1_000_000;
const HAIKU_USD_PER_OUTPUT_TOKEN = 5 / 1_000_000;
const aiCostUsd = (inTok, outTok) =>
  (inTok || 0) * HAIKU_USD_PER_INPUT_TOKEN + (outTok || 0) * HAIKU_USD_PER_OUTPUT_TOKEN;
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
  const childrenOf = (pid) => r.rows.filter((c) => c.parent_id === pid);
  return tops.map((t) => ({
    id: t.id, name: t.name, description: t.description || null,
    // 3 levels: each subcategory carries its own children (sub-subcategories) so the
    // Prepare panel can offer a 3rd-level pick.
    subcats: childrenOf(t.id).map((c) => ({
      id: c.id, name: c.name, description: c.description || null,
      subcats: childrenOf(c.id).map((gc) => ({ id: gc.id, name: gc.name })),
    })),
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
/** House-style taxonomy name from a supplier label: drop "Hire"/"Rental", pluralise
 *  the last word ("Trestle Table Hire" → "Trestle Tables"). Matches how the AI names
 *  new subcats; used as the deterministic 3rd-level fallback for nested sub-groups. */
function houseStyleName(label) {
  const s = String(label).replace(/\s*(hire|rental)\s*$/i, '').trim();
  const words = s.split(/\s+/).filter(Boolean);
  if (!words.length) return s;
  const last = words[words.length - 1];
  if (!/s$/i.test(last)) words[words.length - 1] = last + 's';
  return words.join(' ');
}

/** Bounded-concurrency map — run `fn` over items with at most `limit` in flight.
 *  Preserves order. Lets Prepare fire its per-group AI calls in parallel. */
async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  const worker = async () => { while (i < items.length) { const idx = i++; out[idx] = await fn(items[idx], idx); } };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return out;
}

/** PREPARE (Liam's step 2): for each SELECTED group, map the supplier's category
 *  → a Ballpark category + subcategory (existing or a proposed NEW one). One cheap
 *  AI call per group — we only classify what we're about to load. Returns the real
 *  taxonomy tree (for the dropdowns) + a suggestion per group. `groups` = [{ key,
 *  sample }] where sample is a representative product name/slug. */
async function prepare(groups) {
  const tree = await marketplaceCategoryTree();
  const treeForAi = tree.map((c) => ({
    name: c.name, description: c.description,
    subcats: c.subcats.map((s) => ({ name: s.name, description: s.description, subcats: (s.subcats || []).map((gc) => ({ name: gc.name })) })),
  }));
  const list = (Array.isArray(groups) ? groups : [])
    .map((g) => ({ g, key: String(g?.key ?? '').trim() }))
    .filter((x) => x.key);
  // Classify every group's category CONCURRENTLY (bounded) — one Haiku call each, but
  // in parallel so Prepare isn't N sequential round-trips (analyse is instant now, so
  // the serial classify was the bottleneck). Resolution below is pure/sync.
  const classified = await mapPool(list, 8, async ({ g, key }) => {
    const label = groupLabel(key);
    const pathLabel = groupPathLabel(key); // full supplier path → richer AI context
    let sug = { category: null, subcategory: null, isNew: false, subsubcategory: null, subsubIsNew: false, confidence: 0 };
    // Classify on the GROUP LABEL only — a single product sample dragged broad groups
    // into a narrow L3 (Chairs + a chiavari-ish sample → Chiavari Chair). The clean
    // Woo category name / humanised supplier path carries the real meaning, and exact
    // subcat/L3 homes (e.g. Appliances ▸ Refrigeration) match on the label alone.
    try { sug = await classifyGroupToCategory(pathLabel, '', treeForAi); } catch { /* keep default */ }
    return { key, label, pathLabel, sug };
  });
  const out = [];
  for (const { key, label, pathLabel, sug } of classified) {
    // Resolve the suggested category to a real id (else 'Other').
    const cat = tree.find((c) => norm(c.name) === norm(sug.category)) || tree.find((c) => norm(c.name) === 'other') || null;
    let subId = null, subName = sug.subcategory ? String(sug.subcategory).trim() : null, isNew = !!sug.isNew;
    let subMatch = null;
    if (cat && subName) {
      subMatch = cat.subcats.find((s) => norm(s.name) === norm(subName)) || null;
      if (subMatch) { subId = subMatch.id; subName = subMatch.name; isNew = false; }
      else { isNew = true; } // no close existing → propose new under this cat
    }
    // 3rd level: only when the subcategory is EXISTING (subMatch) — resolve the AI's
    // sub-subcategory to an existing child id or a proposed new one.
    let subSubId = null, subSubName = sug.subsubcategory ? String(sug.subsubcategory).trim() : null, subSubIsNew = !!sug.subsubIsNew;
    if (subMatch && subSubName) {
      const existingSS = (subMatch.subcats || []).find((gc) => norm(gc.name) === norm(subSubName));
      if (existingSS) { subSubId = existingSS.id; subSubName = existingSS.name; subSubIsNew = false; }
      else { subSubIsNew = true; }
    } else { subSubName = null; subSubIsNew = false; } // no 3rd level under a new subcat
    // Fallback: a NESTED supplier sub-group (key has ≥2 path segments, e.g.
    // "table-hire/trestle-table-hire") is a specific type — it should get a 3rd
    // level even when the AI omits one (so Trestle behaves like Coffee/Poseur).
    // …but only when the leaf is genuinely MORE SPECIFIC than the subcategory. Skip
    // when the group's bare leaf name already IS the subcategory (e.g. "Glassware Hire"
    // under subcat "Glassware" — deriving "Glasswares" is redundant + mis-pluralised).
    const bareLeaf = String(label).replace(/\s*(hire|rental)\s*$/i, '').trim();
    if (subMatch && !subSubName && key.split('/').filter(Boolean).length >= 2
        && norm(bareLeaf) !== norm(subMatch.name)) {
      const derived = houseStyleName(label); // "Trestle Table Hire" → "Trestle Tables"
      const existingSS = (subMatch.subcats || []).find((gc) => norm(gc.name) === norm(derived));
      if (existingSS) { subSubId = existingSS.id; subSubName = existingSS.name; subSubIsNew = false; }
      else if (derived && norm(derived) !== norm(subMatch.name)) { subSubName = derived; subSubIsNew = true; }
    }
    out.push({
      key, label, path: pathLabel,
      categoryId: cat?.id || null, categoryName: cat?.name || null,
      subcategoryId: subId, subcategoryName: subName, isNew,
      subsubcategoryId: subSubId, subsubcategoryName: subSubName, subsubIsNew: subSubIsNew,
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
    // New node's parent: the L2 subcategory (newParentId) for a 3rd-level add, else
    // the category for a new subcategory. `level` derives from the parent chain.
    const parentId = row.newParentId || row.categoryId;
    const ck = `${parentId}|${norm(row.subcategoryName)}`;
    if (cache.has(ck)) subcategoryId = cache.get(ck);
    else {
      const found = await pool.query(
        `SELECT id FROM categories WHERE parent_id = $1 AND deleted_at IS NULL
           AND lower(name) = lower($2) LIMIT 1`, [parentId, row.subcategoryName]);
      let didCreate = false;
      if (found.rows[0]) subcategoryId = found.rows[0].id;
      else {
        const anc = await pool.query(
          `WITH RECURSIVE a AS (
             SELECT id, parent_id, 1 AS d FROM categories WHERE id = $1
             UNION ALL SELECT c.id, c.parent_id, a.d + 1 FROM categories c JOIN a ON c.id = a.parent_id
           ) SELECT MAX(d) AS m FROM a`, [parentId]);
        const level = Number(anc.rows[0]?.m || 1); // parent's depth = new node's level
        // 3-level cap (levels 0/1/2) — the same invariant marketplace.js createCategory
        // enforces. This is the create path for BOTH the cat-load and the item pull, so
        // guard here too: never fabricate a 4th level; attach to the deepest allowed node
        // (the parent) instead. Keeps the item placed, just no illegal subtree.
        if (level > 2) {
          subcategoryId = parentId;
        } else {
          didCreate = true;
          const ins = await pool.query(
            `INSERT INTO categories (name, parent_id, namespace, model, level, is_active, enabled, sort_order)
               VALUES ($1, $2, 'catalogue', 'A', $3, false, true, 999) RETURNING id`,
            [row.subcategoryName, parentId, level]);
          subcategoryId = ins.rows[0].id;
        }
      }
      cache.set(ck, subcategoryId);
      return { categoryId: row.categoryId, subcategoryId, created: didCreate };
    }
  }
  return { categoryId: row.categoryId, subcategoryId, created: false };
}

/** Categories-only apply (Liam's 3rd Load mode): create the NEW subcats / sub-subcats
 *  the Prepare mapping needs WITHOUT pulling any items — shape the taxonomy from a
 *  supplier's structure up front, then load items later / in preview. Idempotent
 *  (resolveMappingRow matches an existing node by name), so a later Review/Full pull
 *  reuses these, never duplicates. Admin-gated at the route. */
async function applyMapping(mapping) {
  const map = mapping && typeof mapping === 'object' ? mapping : {};
  const cache = new Map();
  const groups = [];
  let created = 0;
  for (const [key, row] of Object.entries(map)) {
    if (!row || !row.categoryId) { groups.push({ key, status: 'skipped', reason: 'no category chosen' }); continue; }
    const resolved = await resolveMappingRow(row, cache);
    if (resolved.created) created += 1;
    groups.push({ key, status: resolved.created ? 'created' : 'exists', categoryId: resolved.categoryId, subcategoryId: resolved.subcategoryId });
  }
  return { created, groups };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** guardedFetch with politeness: retry on a 429/rate-limit with backoff so an
 *  aggressive crawl doesn't get itself throttled (and give up cleanly if it does). */
async function politeFetch(url, retries = 2) {
  for (let attempt = 0; ; attempt++) {
    try { return await guardedFetch(url); }
    catch (e) {
      if (attempt < retries && /\b429\b|rate.?limit|too many/i.test(e.message || '')) { await sleep(1500 * (attempt + 1)); continue; }
      throw e;
    }
  }
}

// ── Site crawl (bounded BFS) — discovers same-host content URLs. `prefix` (a
//    pathname like "/gazebo-hire") scopes the crawl to ONE section so a category
//    URL can be processed on its own (Liam) instead of the whole site. Polite: a
//    small gap between fetches + 429 backoff; surfaces a seed error clearly. ───────
async function crawlSite(seedUrl, maxPages = CRAWL_MAX_PAGES, prefix = null) {
  const home = normUrl(seedUrl);
  const host = new URL(home).host;
  const sameHost = (u) => { try { return new URL(u).host === host; } catch { return false; } };
  const inScope = (path) => !prefix || path === prefix || path.startsWith(prefix + '/');
  const visited = new Set();
  const discovered = new Set();
  const products = new Set(); // leaf product pages (schema.org Product) — the task list
  const queue = [home];
  let fetched = 0, seedError = null, rl = 0, rateLimited = false;
  while (queue.length && fetched < maxPages) {
    const url = queue.shift();
    if (visited.has(url)) continue;
    visited.add(url);
    if (visited.size > 1) await sleep(80); // politeness gap between pages
    let html;
    try { ({ html } = await politeFetch(url)); fetched++; rl = 0; }
    catch (e) {
      if (fetched === 0 && !seedError) seedError = e.message;
      // Site is actively throttling — after a few 429s, stop rather than grind
      // (each retry backs off) through the whole queue.
      if (/\b429\b|rate.?limit|too many/i.test(e.message || '') && ++rl >= 4) { rateLimited = true; break; }
      continue;
    }
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
  return { pagesFetched: fetched, urls: [...discovered], products: [...products], seedError, rateLimited };
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

// ── Platform profiles (pV2-STORE-PROFILES-01) ────────────────────────────────
// The generic crawler below is the FALLBACK profile (path-hierarchy sites like Yahire).
// Sites that expose an API get a structured, crawl-free profile instead — WooCommerce
// (flat /product/ permalinks + patchy markup make the crawler near-useless: Adana = 249
// junk, Blue Sky = 4 of hundreds) and WordPress posts-as-catalogue (Divi/blog-module
// hire sites like SK Projections, whose items are WP posts on flat permalinks). Both
// live in ./catalogue-extract/profiles; detectProfile picks one, analyse pivots below,
// and the PULL side (processWooUrl / processWordpressUrl) calls back into that module.

// ── ANALYSE (read-only) ───────────────────────────────────────────────────────
// Crawl scoped to the URL's own path — homepage → whole site; a section/category
// ("/catering-equipment-hire") → just that section (any depth below it); a product
// URL → just itself. Products are detected by the Product-JSON-LD signal (AI-free,
// works at any depth), so listing pages are followed for links but never pulled.
// The task list is grouped by the supplier's URL hierarchy in the panel.
async function analyse(url, profile) {
  // API-backed profiles → structured analyse (no crawl). Generic → the crawler below.
  const prof = profile || await detectProfile(url);
  if (prof === 'woo') return analyseWoo(url);
  if (prof === 'wordpress') return analyseWordpress(url);
  const path = isHomepage(url) ? null : new URL(url).pathname.replace(/\/$/, '');
  const { pagesFetched, urls, products, seedError, rateLimited } = await crawlSite(url, CRAWL_MAX_PAGES, path);
  // Couldn't even fetch the starting page — say WHY (rate-limit vs unreachable),
  // don't mislead with "no product pages".
  if (pagesFetched === 0) {
    const rl = rateLimited || /\b429\b|rate.?limit|too many/i.test(seedError || '');
    return {
      url: normUrl(url), pageShape: 'site', pullable: false,
      verdict: rl
        ? 'The site is rate-limiting us right now — wait a minute and try again.'
        : `Couldn't fetch that page${seedError ? ` (${seedError})` : ''} — check the URL and try again.`,
      mapped: { itemCount: 0 }, alsoFound: [], sample: null, productLinks: [], crawledPages: 0, discovered: 0,
    };
  }
  // Fallback for sites without Product JSON-LD: the old depth-2 heuristic.
  const productUrls = products.length ? products : pickItemUrls(urls);
  const rlNote = rateLimited ? ' (stopped early — the site started rate-limiting us; re-run to get the rest)' : '';
  const where = path ? `the ${groupLabel(path.replace(/^\//, ''))} section` : `${pagesFetched} pages`;
  const capped = pagesFetched >= CRAWL_MAX_PAGES ? ` (crawl cap ${CRAWL_MAX_PAGES} reached — narrow to a section for the rest)` : '';
  return {
    url: normUrl(url),
    pageShape: 'site',
    pullable: productUrls.length > 0,
    verdict: productUrls.length
      ? `Crawled ${where} (${pagesFetched} pages) and found ${productUrls.length} product pages to pull.${capped}${rlNote}`
      : `Crawled ${where} (${pagesFetched} pages) but found no product pages — try a category or product URL.${rlNote}`,
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
/** Specificity of a URL's collection, for picking the best of duplicate handles:
 *  0 for generic/utility collections (all/front-page/products), else the path DEPTH
 *  (segment count). A deeper path carries more hierarchy, so it keeps the better
 *  cat/subcat — e.g. /table-hire/coffee-table-hire/x (3) beats /table-hire/x (2),
 *  preserving the Coffee Tables subcategory instead of collapsing to Tables. */
const groupSpecificity = (u) => {
  if (['all', 'front-page', 'frontpage', 'products', 'other'].includes(groupKeyOf(u))) return 0;
  try { return new URL(u).pathname.split('/').filter(Boolean).length; } catch { return 1; }
};
/** Dedup a URL list by product handle, keeping the most specific collection URL —
 *  a Shopify product sits in "all" AND its real collection at different URLs.
 *  Returns { list, dropped:[{url,reason}] } — the dropped set lets the caller
 *  RECONCILE against what was selected, so a pre-loop drop can't silently vanish
 *  an item from the summary (Liam: "20 of 24, no trace"). */
function dedupeByHandle(urls) {
  const best = new Map();
  const dropped = [];
  for (const u of urls) {
    const h = productHandle(u);
    const cur = best.get(h);
    if (!cur) { best.set(h, u); continue; }
    if (groupSpecificity(u) > groupSpecificity(cur)) { dropped.push({ url: cur, reason: `duplicate handle — kept ${u}` }); best.set(h, u); }
    else { dropped.push({ url: u, reason: `duplicate handle — kept ${cur}` }); }
  }
  return { list: [...best.values()], dropped };
}

/** Build the shared pull context — the state that persists ACROSS the per-URL loop
 *  (in-pull dedup, gap tally, subcat cache, the AI vocabulary). One per pull/job. */
async function makePullContext(orgId, opts) {
  return {
    orgId,
    // 'review' = lean triage set (name/description/price/one image); 'full' =
    // everything mappable. Both capture external_url + _source (dedup) + the gaps.
    review: opts.mode === 'review',
    // Prepare-step mapping { groupKey → {categoryId, subcategoryId?, …} } — when
    // present for a group it's AUTHORITATIVE and the per-item AI classifier is skipped.
    mapping: opts.mapping && typeof opts.mapping === 'object' ? opts.mapping : {},
    subcatCache: new Map(),
    gapMap: new Map(),   // "kind|label" → { label, kind, count, example }
    seenIds: new Set(),  // in-pull dedup by the stable vendor identity (sku/product id)
    usage: { input: 0, output: 0, calls: 0 }, // AI token tally (Haiku extractProduct calls)
    batch: `extract-${new Date().toISOString().slice(0, 10)}`,
    categoryNames: await topLevelCategoryNames(), // pass OUR vocabulary to the AI
    profile: opts.profile || 'generic', // 'woo' / 'wordpress' → structured API pull (no AI)
  };
}

/** Plan a pull: dedup by handle + apply the per-pull cap, recording every pre-loop
 *  drop as a 'dropped' outcome row so created+skipped+failed+dropped reconciles
 *  against `selected` — nothing leaves the selection untraced (Liam: "20 of 24"). */
function planPull(urls) {
  const raw = (Array.isArray(urls) ? urls : [urls]).filter(Boolean);
  const { list: deduped, dropped: handleDropped } = dedupeByHandle(raw);
  const list = deduped.slice(0, MAX_PULL_URLS);
  const capDropped = deduped.slice(MAX_PULL_URLS).map((u) => ({ url: u, reason: `over the per-pull cap (${MAX_PULL_URLS}) — pull the rest separately` }));
  const droppedRows = [...handleDropped, ...capDropped].map((d) => ({ url: d.url, status: 'dropped', reason: d.reason }));
  return { selected: raw.length, list, droppedRows };
}

/** Deterministic REVIEW extract from a page's Product JSON-LD (name / price /
 *  description) — ZERO AI. Review needs only the lean vetting set, and on JSON-LD
 *  sites it's all in the markup, so Review skips the Haiku call. Handles a single
 *  or Aggregate offer (price / lowPrice). Returns null when there's no usable
 *  Product node → the caller falls back to the Haiku extractor. */
function extractReviewFromJsonLd(html, url) {
  for (const b of String(html || '').matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j;
    try { j = JSON.parse(b[1].trim()); } catch { continue; }
    const nodes = Array.isArray(j) ? j : (j['@graph'] || [j]);
    for (const n of nodes) {
      const t = n && n['@type'];
      if (!t || !(Array.isArray(t) ? t : [t]).some((x) => /product/i.test(String(x)))) continue;
      const name = typeof n.name === 'string' ? n.name.trim() : '';
      const offer = Array.isArray(n.offers) ? n.offers[0] : n.offers;
      const price = toNumber(offer && (offer.price ?? offer.lowPrice));
      if (name && price != null) {
        return { name, base_price: price, description: typeof n.description === 'string' ? n.description.trim() : null, unit: 'each' };
      }
    }
  }
  return null;
}

/** Extract + create ONE product. Returns a single outcome row and mutates the shared
 *  ctx (gap tally, in-pull id dedup). Never throws — errors become an 'error' row. */
/** Woo pull — fetch ONE product from the Store API (structured, ZERO AI), group by its
 *  real category (→ the Prepare mapping keyed by category slug), map + create. */
async function processWooUrl(ctx, url) {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop();
    const arr = await wooGetJson(`${u.origin}/wp-json/wc/store/v1/products?slug=${encodeURIComponent(slug)}&per_page=1`);
    const p = Array.isArray(arr) ? arr[0] : null;
    if (!p || !p.name) return { url, status: 'skipped', reason: 'no product found (Woo Store API)' };

    const sku = p.sku ? String(p.sku).trim() : null;
    const productId = p.id != null ? String(p.id) : null;
    const permalink = normUrl(p.permalink || url);
    const idKey = productId || sku || slug;
    if (idKey && ctx.seenIds.has(idKey)) return { url: permalink, status: 'skipped', reason: 'duplicate in selection' };
    if (idKey) ctx.seenIds.add(idKey);
    const dupe = await findExisting(ctx.orgId, permalink, sku, productId);
    if (dupe) return { url: permalink, status: 'skipped', reason: 'already imported', itemId: dupe };

    // Group by the product's PRIMARY category → the Prepare mapping (keyed by cat slug).
    const primary = wooPrimaryCategory(p);
    const groupRow = (primary && ctx.mapping[primary.slug]) || null;
    let categoryId, subcategoryId = null, skipClassify = false;
    if (groupRow && groupRow.categoryId) {
      const resolved = await resolveMappingRow(groupRow, ctx.subcatCache);
      categoryId = resolved.categoryId || (await defaultCategoryId());
      subcategoryId = resolved.subcategoryId;
      skipClassify = true;
    } else {
      categoryId = (await matchCategoryId(primary?.name)) || (await defaultCategoryId());
    }

    const images = (Array.isArray(p.images) ? p.images : [])
      .map((im, i) => ({ url: im && im.src, is_hero: i === 0 }))
      .filter((x) => x.url);
    const attributes = { _source: pruneNull({ sku, product_id: productId, handle: p.slug, extracted_at: new Date().toISOString(), batch: ctx.batch }) };
    if (sku) attributes.ids = [{ label: 'SKU', value: sku }];

    const item = await ItemService.createForOrg({
      data: {
        name: String(p.name).trim(),
        base_price: wooPrice(p.prices),
        description: htmlToPlain(p.short_description || p.description || '') || null,
        unit: 'each',
        external_url: permalink,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        attributes,
        images: ctx.review ? images.slice(0, 1) : images,
      },
      orgId: ctx.orgId,
      defaultStatus: 'pending',
      skipClassify,
    });
    return { url: permalink, status: 'created', itemId: item.id, name: item.name };
  } catch (err) {
    return { url, status: 'error', reason: err.message };
  }
}

/** WordPress pull — fetch ONE post via the WP REST API (structured, ZERO AI), group by
 *  its post category (→ the Prepare mapping keyed by category slug), map + create.
 *  Mirrors processWooUrl; price is parsed from the excerpt/content by the profile. */
async function processWordpressUrl(ctx, url) {
  try {
    const u = new URL(url);
    const slug = u.pathname.split('/').filter(Boolean).pop();
    const p = await wpFetchProduct(u.origin, slug);
    if (!p || !p.name) return { url, status: 'skipped', reason: 'no post found (WP REST API)' };

    const permalink = p.permalink || normUrl(url);
    const idKey = p.productId || p.slug;
    if (idKey && ctx.seenIds.has(idKey)) return { url: permalink, status: 'skipped', reason: 'duplicate in selection' };
    if (idKey) ctx.seenIds.add(idKey);
    const dupe = await findExisting(ctx.orgId, permalink, null, p.productId);
    if (dupe) return { url: permalink, status: 'skipped', reason: 'already imported', itemId: dupe };

    // Group by the post's PRIMARY category → the Prepare mapping (keyed by cat slug).
    const groupRow = ctx.mapping[p.categorySlug] || null;
    let categoryId, subcategoryId = null, skipClassify = false;
    if (groupRow && groupRow.categoryId) {
      const resolved = await resolveMappingRow(groupRow, ctx.subcatCache);
      categoryId = resolved.categoryId || (await defaultCategoryId());
      subcategoryId = resolved.subcategoryId;
      skipClassify = true;
    } else {
      categoryId = (await matchCategoryId(p.categoryName)) || (await defaultCategoryId());
    }

    const images = p.imageUrl ? [{ url: p.imageUrl, is_hero: true }] : [];
    const attributes = { _source: pruneNull({ product_id: p.productId, handle: p.slug, extracted_at: new Date().toISOString(), batch: ctx.batch }) };

    const item = await ItemService.createForOrg({
      data: {
        name: p.name,
        base_price: p.price,
        description: p.description,
        unit: 'each',
        external_url: permalink,
        category_id: categoryId,
        subcategory_id: subcategoryId,
        attributes,
        images: ctx.review ? images.slice(0, 1) : images,
      },
      orgId: ctx.orgId,
      defaultStatus: 'pending',
      skipClassify,
    });
    return { url: permalink, status: 'created', itemId: item.id, name: item.name };
  } catch (err) {
    return { url, status: 'error', reason: err.message };
  }
}

async function processUrl(ctx, url) {
  if (ctx.profile === 'woo') return processWooUrl(ctx, url);             // structured, no AI
  if (ctx.profile === 'wordpress') return processWordpressUrl(ctx, url); // structured, no AI
  try {
    const groupRow = ctx.mapping[groupKeyOf(url)] || null; // group keyed off the selected URL
    const { finalUrl, html } = await guardedFetch(url);
    // Review mode: try a DETERMINISTIC extract from the Product JSON-LD first
    // (name/price/description) — ZERO AI. Review only needs the lean vetting set,
    // and on JSON-LD sites (Yahire etc.) it's all in the markup. Full mode, or a
    // page with no usable JSON-LD, falls back to the Haiku extractor.
    let p = ctx.review ? extractReviewFromJsonLd(html, finalUrl) : null;
    if (!p) {
      const r = await extractProduct(htmlToText(html, finalUrl), finalUrl, ctx.categoryNames);
      p = r.data;
      if (r.usage) { // tally the Haiku spend (zero-AI review path skips this)
        ctx.usage.input += r.usage.input_tokens || 0;
        ctx.usage.output += r.usage.output_tokens || 0;
        ctx.usage.calls += 1;
      }
    }
    const name = (p && typeof p.name === 'string') ? p.name.trim() : '';
    if (!name) return { url: finalUrl, status: 'skipped', reason: 'no product found (not a detail page?)' };

    // Stable vendor identity, parsed deterministically from structured data (not the
    // AI): the SKU/id is the vendor's + agent's key AND the reliable dedup key.
    const identity = extractIdentity(html, finalUrl);
    const sku = identity.sku || (p.sku ? String(p.sku).trim() : null);
    const productId = identity.productId;
    const idKey = productId || sku || identity.handle;
    if (idKey && ctx.seenIds.has(idKey)) return { url: finalUrl, status: 'skipped', reason: 'duplicate in selection' };
    if (idKey) ctx.seenIds.add(idKey);
    const dupe = await findExisting(ctx.orgId, finalUrl, sku, productId);
    if (dupe) return { url: finalUrl, status: 'skipped', reason: 'already imported', itemId: dupe };

    // Gap report: data present on the page with no home in our model. Aggregated
    // across the imported items → "couldn't store yet: X (12 items)". Free — it
    // rides on the extract call we already made. (See noHome in PULL_SYSTEM.)
    for (const g of (Array.isArray(p.noHome) ? p.noHome : [])) {
      const label = String(g?.label ?? '').trim();
      if (!label) continue;
      const kind = String(g?.kind ?? 'other').trim().toLowerCase() || 'other';
      const key = `${kind}|${label.toLowerCase()}`;
      const hit = ctx.gapMap.get(key) || { label, kind, count: 0, example: String(g?.value ?? '').trim() || null };
      hit.count += 1;
      ctx.gapMap.set(key, hit);
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
      extracted_at: new Date().toISOString(), batch: ctx.batch,
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
      const resolved = await resolveMappingRow(groupRow, ctx.subcatCache);
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
        install_description: ctx.review ? null : (typeof p.install_description === 'string' ? p.install_description.trim() : null),
        install_cost: ctx.review ? null : toNumber(p.install_cost),
        lead_time_days: ctx.review ? null : toNumber(p.lead_time_days),
        external_url: finalUrl, // PRIMARY source URL — dedup/delta key
        category_id: categoryId,
        subcategory_id: subcategoryId,
        attributes: ctx.review ? reviewAttrs : attributes,
        images: ctx.review ? images.slice(0, 1) : images,
      },
      orgId: ctx.orgId,
      defaultStatus: 'pending',
      skipClassify,
    });

    return { url: finalUrl, status: 'created', itemId: item.id, name: item.name, optionCount: ctx.review ? 0 : options.length };
  } catch (err) {
    return { url, status: 'error', reason: err.message };
  }
}

/** Tally outcome rows + the gap report into the summary the client renders. */
function summarizePull(ctx, results, selected) {
  const count = (s) => results.filter((r) => r.status === s).length;
  return {
    created: count('created'), skipped: count('skipped'), failed: count('error'), dropped: count('dropped'),
    selected, mode: ctx.review ? 'review' : 'full',
    gaps: [...ctx.gapMap.values()].sort((a, b) => b.count - a.count),
    results,
    inputTokens: ctx.usage.input, outputTokens: ctx.usage.output,
    costUsd: aiCostUsd(ctx.usage.input, ctx.usage.output),
  };
}

/** Synchronous pull — kept for a single detail page / small selection where waiting
 *  is fine. Whole-catalogue pulls go through the background job (startPull) instead. */
async function pull(orgId, urls, opts = {}) {
  const { selected, list, droppedRows } = planPull(urls);
  const profile = opts.profile || (list.length ? await detectProfile(list[0]) : 'generic');
  const ctx = await makePullContext(orgId, { ...opts, profile });
  const results = [...droppedRows];
  for (const url of list) results.push(await processUrl(ctx, url));
  return summarizePull(ctx, results, selected);
}

// ── Background PULL jobs (pV2-STORE-EXTRACT-JOB-01) ────────────────────────────
// A whole-catalogue pull is minutes long — too long for one HTTP request, and the
// admin may navigate away. So a pull becomes a JOB row: the plan (deduped URL list
// + mapping) is snapshotted BEFORE any work, an in-process runner processes it,
// persisting progress per item, and the panel polls (re-attaching on return). A
// cancel flag stops it cleanly between items; items already created stay pending.

/** Run `fn` with a PINNED DB client carrying the admin GUCs (app.is_admin='t' +
 *  org/user), so the DETACHED runner's writes satisfy the same RLS the admin
 *  REQUEST did — the request's own pinned client (middleware/request-context.js)
 *  is released once the HTTP response ends, so a fire-and-forget task must
 *  re-establish the context. Legitimate: startPull is only reachable through the
 *  admin gate. pool.js prefers ctx.client for every query, so createForOrg's
 *  insert + our job writes all carry the admin context. RESET ALL on the way out. */
async function withAdminContext({ orgId, userId }, fn) {
  const client = await pool.connect();
  const ctx = { userId: userId || null, orgId: orgId || null, isAdmin: true, client };
  try {
    await client.query(
      "SELECT set_config('app.current_org_id',$1,false), set_config('app.current_user_id',$2,false), set_config('app.is_admin','t',false)",
      [ctx.orgId, ctx.userId],
    );
    return await als.run(ctx, fn);
  } finally {
    await client.query('RESET ALL').catch(() => {});
    client.release();
  }
}

/** Shape a job row for the client. Two kinds:
 *   'pull'    → the PullResult fields + live progress + AI cost.
 *   'analyse' → a report-shaped payload (productLinks + per-section coverage) so the
 *               panel can drop straight into its task list when the fan-out finishes. */
function jobToClient(row) {
  if (!row) return null;
  const progress = row.progress || {};
  const base = {
    jobId: row.id,
    kind: row.kind || 'pull',
    status: row.status,                 // running | cancelling | cancelled | done | error
    processed: progress.processed || 0,
    total: row.total,
    error: row.error || null,
    updatedAt: row.updated_at,
  };
  if ((row.kind || 'pull') === 'analyse') {
    const productLinks = (row.plan && row.plan.productLinks) || [];
    return {
      ...base,
      sections: row.results || [],      // [{ section, path, count }] — the coverage map
      productLinks,
      // Report-shaped fields the panel consumes when the fan-out completes.
      url: (row.plan && row.plan.home) || null,
      pageShape: 'site',
      pullable: productLinks.length > 0,
      verdict: `Fan-out scan: ${progress.processed || 0}/${row.total || 0} sections · ${productLinks.length} products found.`,
      mapped: { itemCount: productLinks.length },
    };
  }
  return {
    ...base,
    mode: row.mode,
    selected: row.selected,
    created: progress.created || 0,
    skipped: progress.skipped || 0,
    failed: progress.failed || 0,
    dropped: (row.plan?.dropped || []).length,
    gaps: row.gaps || [],
    results: row.results || [],
    inputTokens: row.input_tokens || 0,
    outputTokens: row.output_tokens || 0,
    costUsd: aiCostUsd(row.input_tokens, row.output_tokens),
  };
}

async function loadPlan(jobId) {
  const r = await pool.query(`SELECT plan FROM catalogue_extract_job WHERE id = $1`, [jobId]);
  const plan = r.rows[0]?.plan || {};
  return { list: plan.list || [], dropped: plan.dropped || [], mapping: plan.mapping || {} };
}
async function isCancelled(jobId) {
  const r = await pool.query(`SELECT status FROM catalogue_extract_job WHERE id = $1`, [jobId]);
  return r.rows[0]?.status === 'cancelling';
}

/** Create the job (plan snapshot) + kick off the runner; return the job id at once. */
async function startPull(orgId, urls, opts = {}, createdBy = null) {
  // One active pull per org. A second concurrent pull would race the app-level dedup
  // (per-run seenIds + non-atomic findExisting) and could create duplicate items, so
  // refuse to start while one is live. An analyse (fan-out) job writes no items, so it
  // doesn't block. The panel already guards client-side; this closes the server side.
  const active = await activeJobForOrg(orgId);
  if (active && active.kind !== 'analyse') {
    const err = new Error('A pull is already running for this supplier — wait for it to finish or cancel it first.');
    err.code = 'pull_in_progress';
    err.jobId = active.jobId;
    throw err;
  }
  const { selected, list, droppedRows } = planPull(urls);
  const profile = opts.profile || (list.length ? await detectProfile(list[0]) : 'generic');
  const plan = { list, dropped: droppedRows, mapping: opts.mapping && typeof opts.mapping === 'object' ? opts.mapping : {}, profile };
  const progress = { processed: 0, created: 0, skipped: 0, failed: 0 };
  const r = await pool.query(
    `INSERT INTO catalogue_extract_job (org_id, status, mode, selected, total, plan, progress, results, created_by)
     VALUES ($1, 'running', $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
    [orgId, opts.mode === 'review' ? 'review' : 'full', selected, list.length,
     JSON.stringify(plan), JSON.stringify(progress), JSON.stringify(droppedRows), createdBy],
  );
  const jobId = r.rows[0].id;
  // Fire-and-forget — the HTTP response returns now; the runner outlives the request,
  // so it re-establishes the admin DB context (the request's is gone) for its writes.
  withAdminContext({ orgId, userId: createdBy }, () => runJob(jobId, orgId, { ...opts, profile })).catch((e) => {
    pool.query(`UPDATE catalogue_extract_job SET status='error', error=$2, updated_at=now() WHERE id=$1`, [jobId, String(e && e.message || e)]).catch(() => {});
  });
  return { jobId, selected, total: list.length, dropped: droppedRows.length };
}

/** The runner: process the planned URLs one at a time, persisting progress + results
 *  after each, and stopping cleanly when the job is cancelled. */
async function runJob(jobId, orgId, opts) {
  const ctx = await makePullContext(orgId, opts);
  const plan = await loadPlan(jobId);
  const results = [...plan.dropped];
  const progress = { processed: 0, created: 0, skipped: 0, failed: 0 };
  for (const url of plan.list) {
    if (await isCancelled(jobId)) {
      await pool.query(`UPDATE catalogue_extract_job SET status='cancelled', updated_at=now() WHERE id=$1`, [jobId]);
      return;
    }
    const row = await processUrl(ctx, url);
    results.push(row);
    progress.processed += 1;
    if (row.status === 'created') progress.created += 1;
    else if (row.status === 'skipped') progress.skipped += 1;
    else if (row.status === 'error') progress.failed += 1;
    const gaps = [...ctx.gapMap.values()].sort((a, b) => b.count - a.count);
    await pool.query(
      `UPDATE catalogue_extract_job SET progress=$2, results=$3, gaps=$4, input_tokens=$5, output_tokens=$6, updated_at=now() WHERE id=$1`,
      [jobId, JSON.stringify(progress), JSON.stringify(results), JSON.stringify(gaps), ctx.usage.input, ctx.usage.output],
    );
  }
  // A cancel that lands after the last item still resolves to 'cancelled'; else 'done'.
  await pool.query(
    `UPDATE catalogue_extract_job SET status = CASE WHEN status='cancelling' THEN 'cancelled' ELSE 'done' END, updated_at=now() WHERE id=$1`,
    [jobId],
  );
}

/** Poll target — one job by id, scoped to its org. */
async function getJob(jobId, orgId) {
  const r = await pool.query(`SELECT * FROM catalogue_extract_job WHERE id = $1 AND org_id = $2`, [jobId, orgId]);
  return jobToClient(r.rows[0]);
}

/** The org's most recent still-running job — for the panel to re-attach on return.
 *  Ignores rows not updated in 10 min: a live runner writes progress far more often
 *  (every item/section), so a stale row is an orphan (dead runner), not a live job. */
async function activeJobForOrg(orgId) {
  const r = await pool.query(
    `SELECT * FROM catalogue_extract_job
      WHERE org_id = $1 AND status IN ('running','cancelling')
        AND updated_at > now() - interval '10 minutes'
      ORDER BY created_at DESC LIMIT 1`,
    [orgId],
  );
  return jobToClient(r.rows[0]);
}

/** Boot janitor: in-process job runners don't survive a server restart, so any job
 *  left 'running'/'cancelling' when the process starts is an orphan — mark it errored.
 *  Called once from index.js at startup. Single-server assumption (no other process
 *  could own a live job). */
async function failStaleJobs() {
  try {
    const r = await pool.query(
      `UPDATE catalogue_extract_job SET status='error', error='interrupted by a server restart', updated_at=now()
        WHERE status IN ('running','cancelling') RETURNING id`,
    );
    if (r.rows.length) console.log(`[extract] cleared ${r.rows.length} stale job(s) on boot`);
  } catch (e) { console.warn('[extract] failStaleJobs failed:', e.message); }
}

/** Request cancel — the runner stops before the next item/section. Only a running job. */
async function cancelJob(jobId, orgId) {
  const r = await pool.query(
    `UPDATE catalogue_extract_job SET status='cancelling', updated_at=now() WHERE id=$1 AND org_id=$2 AND status='running' RETURNING id`,
    [jobId, orgId],
  );
  return r.rows.length > 0;
}

// ── Fan-out ANALYSE (pV2-STORE-EXTRACT-JOB-01) ────────────────────────────────
// A whole-site crawl starves under the 250-page cap (BFS spreads it thin, so late
// sections come back empty — the linen bug). The fan-out enumerates the top-level
// sections and crawls EACH with its own full budget, then unions — a complete,
// correctly-nested index (our own "sitemap") the supplier's own doesn't expose.
// Zero AI (pure crawl). Runs as a background job with per-section coverage.
const MAX_ANALYSE_SECTIONS = 60; // guard a pathological site with hundreds of roots.

/** Section roots the site's SITEMAP lists — reliable for the SECTION LIST even
 *  though it omits deep products (why we crawl each section rather than trust it). */
async function fetchSitemapSectionRoots(homeUrl) {
  const origin = new URL(homeUrl).origin;
  let files = [];
  try {
    const { html: robots } = await guardedFetch(origin + '/robots.txt');
    for (const m of String(robots).matchAll(/^\s*sitemap:\s*(\S+)/gim)) files.push(m[1].trim());
  } catch { /* no robots — try the conventional path */ }
  if (!files.length) files = [origin + '/sitemap.xml'];
  const roots = new Set();
  const seen = new Set();
  const queue = [...files];
  let fetched = 0;
  while (queue.length && fetched < 20) {
    const su = queue.shift();
    if (!su || seen.has(su)) continue;
    seen.add(su);
    let xml;
    try { ({ html: xml } = await guardedFetch(su)); fetched++; } catch { continue; }
    xml = String(xml || '');
    const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map((m) => m[1]);
    if (/<sitemapindex/i.test(xml)) {
      for (const l of locs) if (!/\.gz(\?|$)/i.test(l)) queue.push(l);
    } else {
      for (const l of locs) { try { const segs = new URL(l).pathname.split('/').filter(Boolean); if (segs.length >= 1) roots.add('/' + segs[0]); } catch { /* skip */ } }
    }
  }
  return [...roots];
}

/** The top-level sections to fan out over: homepage nav links ∪ sitemap section
 *  roots (belt and braces), same-host, non-asset, de-duplicated to depth-1 paths. */
async function discoverSections(homeUrl) {
  const host = new URL(homeUrl).host;
  const roots = new Set();
  const addPath = (p) => { const segs = String(p).split('/').filter(Boolean); if (segs.length >= 1 && !CRAWL_SKIP.test('/' + segs[0])) roots.add('/' + segs[0]); };
  try {
    const { html } = await guardedFetch(homeUrl);
    for (const m of String(html).matchAll(/href=["']([^"'#]+)["']/gi)) {
      let abs; try { abs = normUrl(new URL(m[1], homeUrl).toString()); } catch { continue; }
      try { const u = new URL(abs); if (u.host !== host || CRAWL_SKIP.test(abs) || abs.includes('?')) continue; addPath(u.pathname); } catch { /* skip */ }
    }
  } catch { /* homepage unreachable — sitemap may still yield sections */ }
  try { for (const p of await fetchSitemapSectionRoots(homeUrl)) addPath(p); } catch { /* no sitemap */ }
  return [...roots];
}

/** Create a fan-out ANALYSE job + kick the runner; return the job id immediately.
 *  No admin DB context needed — it writes only the job row (no RLS) and never
 *  touches items. */
async function startAnalyseJob(orgId, url) {
  const plan = { home: normUrl(url), sections: [], productLinks: [] };
  const r = await pool.query(
    `INSERT INTO catalogue_extract_job (org_id, kind, status, plan, progress) VALUES ($1, 'analyse', 'running', $2, '{}'::jsonb) RETURNING id`,
    [orgId, JSON.stringify(plan)],
  );
  const jobId = r.rows[0].id;
  runAnalyseJob(jobId, orgId, plan.home).catch((e) => {
    pool.query(`UPDATE catalogue_extract_job SET status='error', error=$2, updated_at=now() WHERE id=$1`, [jobId, String(e && e.message || e)]).catch(() => {});
  });
  return { jobId, kind: 'analyse', async: true };
}

/** The runner: crawl each section with its own full budget, unioning + deduping the
 *  products, persisting per-section coverage + the running product list. */
async function runAnalyseJob(jobId, orgId, home) {
  const sections = (await discoverSections(home)).slice(0, MAX_ANALYSE_SECTIONS);
  await pool.query(
    `UPDATE catalogue_extract_job SET total=$2, plan=jsonb_set(plan,'{sections}',$3::jsonb), updated_at=now() WHERE id=$1`,
    [jobId, sections.length, JSON.stringify(sections)],
  );
  const found = new Map(); // product handle → url (cross-section dedup)
  const coverage = [];     // [{ section, path, count }] — the per-section success map
  const progress = { processed: 0 };
  for (const section of sections) {
    if (await isCancelled(jobId)) {
      await pool.query(`UPDATE catalogue_extract_job SET status='cancelled', updated_at=now() WHERE id=$1`, [jobId]);
      return;
    }
    let products = [];
    try { ({ products } = await crawlSite(home, CRAWL_MAX_PAGES, section)); } catch { /* section unreachable → 0 */ }
    for (const u of products) { const h = productHandle(u); if (!found.has(h)) found.set(h, u); }
    coverage.push({ section: groupLabel(section.replace(/^\//, '')), path: section, count: products.length });
    progress.processed += 1;
    const productLinks = [...found.values()];
    await pool.query(
      `UPDATE catalogue_extract_job SET progress=$2, results=$3, plan=jsonb_set(plan,'{productLinks}',$4::jsonb), updated_at=now() WHERE id=$1`,
      [jobId, JSON.stringify(progress), JSON.stringify(coverage), JSON.stringify(productLinks)],
    );
  }
  await pool.query(
    `UPDATE catalogue_extract_job SET status = CASE WHEN status='cancelling' THEN 'cancelled' ELSE 'done' END, updated_at=now() WHERE id=$1`,
    [jobId],
  );
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

module.exports = { analyse, startAnalyseJob, detectProfile, prepare, applyMapping, pull, startPull, getJob, activeJobForOrg, cancelJob, failStaleJobs, _internals: { htmlToText, matchCategoryId, toNumber, routeAttributes, collectImageUrls, collectJsonLdImages, marketplaceCategoryTree, groupKeyOf, dedupeByHandle, productHandle, extractIdentity, extractReviewFromJsonLd } };
