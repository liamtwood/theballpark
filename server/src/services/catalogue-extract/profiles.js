// pV2-STORE-PROFILES-01 — platform PROFILES for the catalogue extract.
//
// A profile is a structured (crawl-free) way to read a supplier's catalogue when the
// platform exposes an API. detectProfile picks one from the site; each profile's
// analyse* returns the SAME report shape the generic crawler does, plus `linkGroups`
// (permalink → {key,label}) so the panel groups by real category, not a flat URL.
//
//   woo       — WooCommerce Store API (/wp-json/wc/store/v1/products)
//   wordpress — WordPress posts-as-catalogue (Divi/blog-module hire sites): items are
//               WP posts with prices in the excerpt, grouped by post category
//               (/wp-json/wp/v2/posts + /categories). Flat post permalinks carry no
//               hierarchy, so — like Woo — grouping rides linkGroups.
//   generic   — no API; the crawler in the main service handles it.
//
// This is a LEAF module: it imports only guardedFetch + util primitives, never the
// main service, so there's no require cycle. The PULL side (createForOrg, mapping)
// lives in the main service and calls back into wooGetJson / wpFetchProduct here.

const { guardedFetch } = require('../org-import.service');
const { normUrl, htmlToPlain } = require('./util');

const WOO_MAX_PAGES = 30; // Store API per_page=100 → up to 3000 products
const WP_MAX_PAGES = 30;  // wp/v2 per_page=100 → up to 3000 posts

/** GET + parse a JSON endpoint through the SSRF-safe guarded fetch. */
async function fetchJson(url) {
  const { html } = await guardedFetch(url);
  return JSON.parse(html);
}
// Woo pull (main service) still calls wooGetJson by name.
const wooGetJson = fetchJson;

// ── detect ────────────────────────────────────────────────────────────────────
/** Which extraction profile fits this site — 'woo', 'wordpress', or 'generic'
 *  (the crawler). Woo wins first (a Woo site is also WordPress). 'wordpress' needs
 *  a PRICE signal in the posts so we don't hijack a plain blog/marketing WP site
 *  whose posts are articles rather than hire items. */
async function detectProfile(url) {
  const origin = new URL(url).origin;
  try {
    const j = await wooGetJson(`${origin}/wp-json/wc/store/v1/products?per_page=1`);
    if (Array.isArray(j)) return 'woo';
  } catch { /* not Woo, or blocked */ }
  try {
    const posts = await fetchJson(`${origin}/wp-json/wp/v2/posts?per_page=20&_fields=excerpt`);
    if (Array.isArray(posts) && posts.length) {
      const priced = posts.filter((p) => /[£$€]\s?\d/.test((p.excerpt && p.excerpt.rendered) || '')).length;
      if (priced >= 3) return 'wordpress';
    }
  } catch { /* no wp/v2, or blocked */ }
  return 'generic';
}

// ── WooCommerce ─────────────────────────────────────────────────────────────────
/** Woo Store API prices are minor-unit strings ("13000" + currency_minor_unit 2 → 130.00). */
function wooPrice(prices) {
  if (!prices || prices.price == null) return null;
  const minor = Number(prices.currency_minor_unit ?? 2);
  const n = Number(prices.price);
  return Number.isFinite(n) ? n / Math.pow(10, minor) : null;
}

/** A product's primary category (first non-Uncategorized) — the grouping key. */
function wooPrimaryCategory(p) {
  const cats = Array.isArray(p.categories) ? p.categories : [];
  return cats.find((c) => !/^uncategor/i.test(c.slug || '')) || cats[0] || null;
}

/** Fetch every product from the Woo Store API (paged, bounded). */
async function wooAllProducts(origin) {
  const out = [];
  for (let page = 1; page <= WOO_MAX_PAGES; page++) {
    let batch;
    try { batch = await wooGetJson(`${origin}/wp-json/wc/store/v1/products?per_page=100&page=${page}`); }
    catch { break; }
    if (!Array.isArray(batch) || !batch.length) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** ANALYSE (Woo) — structured, no crawl. Products from the Store API, grouped by their
 *  real category. Returns the report + `linkGroups` (permalink → {key,label}) so the
 *  panel groups by category, not the flat /product/ URL. */
async function analyseWoo(url) {
  const origin = new URL(url).origin;
  const products = await wooAllProducts(origin);
  const linkGroups = {};
  const groupCount = {};
  const productLinks = [];
  for (const p of products) {
    const permalink = normUrl(p.permalink || '');
    if (!permalink || !p.name) continue;
    const primary = wooPrimaryCategory(p);
    const key = primary?.slug || 'uncategorized';
    const label = primary?.name || 'Uncategorized';
    linkGroups[permalink] = { key, label };
    groupCount[key] = (groupCount[key] || 0) + 1;
    productLinks.push(permalink);
  }
  const nCats = Object.keys(groupCount).length;
  return {
    url: normUrl(url), pageShape: 'site', pullable: productLinks.length > 0,
    verdict: productLinks.length
      ? `WooCommerce store — ${productLinks.length} products across ${nCats} categories (structured, via the Store API).`
      : 'WooCommerce detected but the Store API returned no products.',
    mapped: { itemCount: productLinks.length },
    alsoFound: [], sample: null,
    productLinks, linkGroups, source: 'woo',
  };
}

// ── WordPress (posts-as-catalogue) ──────────────────────────────────────────────
/** First £/$/€ amount in a blob of text (WP hire posts put "£150 / day" in the excerpt). */
function wpParsePrice(text) {
  const m = String(text || '').match(/[£$€]\s?([\d,]+(?:\.\d+)?)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}

/** The post's primary category term from an _embed'd post (skip Uncategorized). */
function wpPrimaryTerm(post) {
  const groups = (post._embedded && post._embedded['wp:term']) || [];
  const terms = [].concat(...groups).filter((t) => t && t.taxonomy === 'category');
  return terms.find((t) => !/^uncategor/i.test(t.slug || '')) || terms[0] || null;
}

/** Fetch every catalogue post (paged, bounded), each with its category embedded. */
async function wpAllPosts(origin) {
  const out = [];
  for (let page = 1; page <= WP_MAX_PAGES; page++) {
    let batch;
    try { batch = await fetchJson(`${origin}/wp-json/wp/v2/posts?per_page=100&page=${page}&_embed=wp:term`); }
    catch { break; }
    if (!Array.isArray(batch) || !batch.length) break;
    out.push(...batch);
    if (batch.length < 100) break;
  }
  return out;
}

/** ANALYSE (WordPress) — structured, no crawl. Items = WP posts, grouped by their post
 *  category. Same report shape + `linkGroups` as Woo (post permalinks are flat, so the
 *  hierarchy comes from the category, not the URL). */
async function analyseWordpress(url) {
  const origin = new URL(url).origin;
  const posts = await wpAllPosts(origin);
  const linkGroups = {};
  const groupCount = {};
  const productLinks = [];
  for (const p of posts) {
    const permalink = normUrl(p.link || '');
    const name = p.title && p.title.rendered;
    if (!permalink || !name) continue;
    const term = wpPrimaryTerm(p);
    const key = term?.slug || 'uncategorized';
    const label = (term && htmlToPlain(term.name)) || 'Uncategorized';
    linkGroups[permalink] = { key, label };
    groupCount[key] = (groupCount[key] || 0) + 1;
    productLinks.push(permalink);
  }
  const nCats = Object.keys(groupCount).length;
  return {
    url: normUrl(url), pageShape: 'site', pullable: productLinks.length > 0,
    verdict: productLinks.length
      ? `WordPress catalogue — ${productLinks.length} items across ${nCats} categories (structured, via the WP REST API).`
      : 'WordPress detected but no catalogue posts were found.',
    mapped: { itemCount: productLinks.length },
    alsoFound: [], sample: null,
    productLinks, linkGroups, source: 'wordpress',
  };
}

/** PULL (WordPress) — fetch ONE post by slug + normalise to the fields the item-create
 *  path needs. Structured, ZERO AI (title/excerpt/category/featured image all come from
 *  the REST payload; price is parsed from the excerpt/content). Returns null if missing. */
async function wpFetchProduct(origin, slug) {
  const arr = await fetchJson(`${origin}/wp-json/wp/v2/posts?slug=${encodeURIComponent(slug)}&_embed&per_page=1`);
  const post = Array.isArray(arr) ? arr[0] : null;
  if (!post) return null;
  const term = wpPrimaryTerm(post);
  const media = (post._embedded && post._embedded['wp:featuredmedia'] && post._embedded['wp:featuredmedia'][0]) || null;
  const excerpt = (post.excerpt && post.excerpt.rendered) || '';
  const content = (post.content && post.content.rendered) || '';
  return {
    name: htmlToPlain((post.title && post.title.rendered) || '').trim(),
    permalink: normUrl(post.link || ''),
    productId: post.id != null ? String(post.id) : null,
    slug: post.slug || slug,
    categorySlug: term?.slug || 'uncategorized',
    categoryName: (term && htmlToPlain(term.name)) || 'Uncategorized',
    description: htmlToPlain(excerpt || content) || null,
    price: wpParsePrice(excerpt) ?? wpParsePrice(content),
    imageUrl: (media && media.source_url) || null,
  };
}

module.exports = {
  detectProfile,
  // Woo
  analyseWoo, wooGetJson, wooPrice, wooPrimaryCategory,
  // WordPress
  analyseWordpress, wpFetchProduct,
};
