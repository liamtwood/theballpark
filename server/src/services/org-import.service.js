// pV2-IMPORT-ORG-01 (BE-00127) — deterministic supplier-org extraction from a
// vendor website. NO AI: a field-by-field coalesce from structured data
// (JSON-LD first, then og:/meta, then footer regex), each field carrying a
// confidence (high|medium|low) so the UI can fill-silently / fill-and-flag /
// leave-blank. Dependency-free: Node 24 `fetch` + regex + JSON.parse (no
// cheerio/jsdom). The pure parser (`parseOrgFromHtml`) is split from the fetch
// so it unit-tests from saved HTML fixtures with no network.

const dns = require('dns').promises;
const net = require('net');

const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const MAX_BODY_BYTES = 2 * 1024 * 1024; // 2MB cap

// ── helpers ──────────────────────────────────────────────────────────────────
const firstNonEmpty = (xs) => xs.map((s) => (s ?? '').toString().trim()).find((s) => s) || null;

/** A found field: { value, confidence }. Omitted entirely when value is null. */
const field = (value, confidence) => (value ? { value: String(value).trim(), confidence } : null);

/** Parse every <script type="application/ld+json"> block; tolerant (skip bad). */
function extractJsonLdBlocks(html) {
  const out = [];
  const re = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    const raw = m[1].trim();
    if (!raw) continue;
    try {
      out.push(JSON.parse(raw));
    } catch {
      // Some sites emit multiple concatenated objects or trailing commas — skip.
    }
  }
  return out;
}

/** Flatten JSON-LD blocks + their @graph arrays into a flat node list. */
function flattenGraph(blocks) {
  const nodes = [];
  const visit = (b) => {
    if (!b) return;
    if (Array.isArray(b)) { b.forEach(visit); return; }
    if (typeof b !== 'object') return;
    if (Array.isArray(b['@graph'])) b['@graph'].forEach(visit);
    nodes.push(b);
  };
  blocks.forEach(visit);
  return nodes;
}

/** @type may be a string or an array; test membership case-insensitively. */
function typeIncludes(node, wanted) {
  const t = node && node['@type'];
  const arr = Array.isArray(t) ? t : [t];
  return arr.some((x) => typeof x === 'string' && wanted.includes(x));
}

/** The site-level Organization/LocalBusiness node (first match). */
function findOrgNode(nodes) {
  return nodes.find((n) => typeIncludes(n, ['Organization', 'LocalBusiness', 'Corporation', 'Store'])) || null;
}

/** JSON-LD image/logo can be a string, an ImageObject {url}, or an array. */
function firstImageUrl(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return firstImageUrl(v[0]);
  if (typeof v === 'object') return v.url || v.contentUrl || null;
  return null;
}

/** <meta name|property=... content=...> → map keyed by the name/property. */
function extractMeta(html) {
  const meta = {};
  const re = /<meta\b[^>]*>/gi;
  let m;
  while ((m = re.exec(html))) {
    const tag = m[0];
    const key = (tag.match(/\b(?:name|property)=["']([^"']+)["']/i) || [])[1];
    const content = (tag.match(/\bcontent=["']([^"']*)["']/i) || [])[1];
    if (key && content != null) meta[key.toLowerCase()] = content;
  }
  return meta;
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

function extractHref(html, scheme) {
  const re = new RegExp(`href=["']${scheme}:([^"'?]+)`, 'i');
  const m = html.match(re);
  return m ? decodeURIComponent(m[1].trim()) : null;
}

// UK-centric footer patterns (per spec acceptance = yahire.com); best-effort/low.
function extractCompanyNumber(html) {
  const m = html.match(/company\s*(?:number|no|reg(?:istration)?(?:\s*number|\s*no)?)\.?\s*[:#]?\s*(\d{6,8})/i);
  return m ? m[1] : null;
}
function extractVatNumber(html) {
  const m = html.match(/VAT\s*(?:reg\w*)?\s*(?:number|no)?\.?\s*[:#]?\s*((?:GB)?[\d\s]{9,})/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : null;
}

// Minimal country→currency inference (low confidence; admin corrects).
const COUNTRY_CCY = {
  GB: 'GBP', UK: 'GBP', 'United Kingdom': 'GBP',
  US: 'USD', USA: 'USD', 'United States': 'USD',
  IE: 'EUR', FR: 'EUR', DE: 'EUR', ES: 'EUR', IT: 'EUR', NL: 'EUR',
  AU: 'AUD', CA: 'CAD', NZ: 'NZD',
};
function inferCurrency(countryRaw) {
  if (!countryRaw) return 'GBP';
  const key = String(countryRaw).trim();
  return COUNTRY_CCY[key] || COUNTRY_CCY[key.toUpperCase()] || 'GBP';
}

// ── pure parse (unit-tested from fixtures) ───────────────────────────────────
/**
 * Parse a normalized org map (per-field {value, confidence}) from HTML.
 * @param {string} html
 * @param {{isHomepage?: boolean, url?: string}} opts
 * @returns {{ org: Record<string,{value:string,confidence:'high'|'medium'|'low'}>, source: {jsonLd:boolean, og:boolean} }}
 */
function parseOrgFromHtml(html, { isHomepage = true, url = null } = {}) {
  const nodes = flattenGraph(extractJsonLdBlocks(html));
  const org = findOrgNode(nodes) || {};
  const meta = extractMeta(html);
  const hasOg = Object.keys(meta).some((k) => k.startsWith('og:'));

  // Address (PostalAddress object) — medium per spec.
  const addr = org.address && typeof org.address === 'object' && !Array.isArray(org.address) ? org.address : {};
  const country = firstNonEmpty([
    typeof addr.addressCountry === 'object' ? addr.addressCountry.name : addr.addressCountry,
  ]);

  const out = {};
  const put = (k, f) => { if (f) out[k] = f; };

  put('name', field(org.name, 'high') || field(meta['og:site_name'], 'medium') || field(extractTitle(html), 'medium'));
  put('description',
    field(org.description, 'high')
    || field(meta['og:description'], 'medium')
    || (isHomepage ? field(meta['description'], 'medium') : null));
  put('website', field(url ? safeOrigin(url) : firstNonEmpty([org.url]), 'high'));
  put('logo_url', field(firstImageUrl(org.logo), 'high') || field(meta['og:image'], 'medium'));
  put('cover_image_url', field(firstImageUrl(org.image), 'high') || field(meta['og:image'], 'medium'));
  put('address', field(addr.streetAddress, 'medium'));
  put('city', field(addr.addressLocality, 'medium'));
  put('country', field(country, 'medium'));
  put('phone', field(org.telephone, 'high') || field(extractHref(html, 'tel'), 'medium'));
  put('email', field(org.email, 'high') || field(extractHref(html, 'mailto'), 'medium'));

  const companyNumber = extractCompanyNumber(html);
  put('company_number', field(companyNumber, 'low'));
  const vat = extractVatNumber(html);
  if (vat) {
    out.vat_number = { value: vat, confidence: 'low' };
    out.vat_registered = { value: 'true', confidence: 'low' };
  }

  // Currency: low — inferred from country (or GBP default).
  out.default_currency = { value: inferCurrency(country), confidence: 'low' };

  return { org: out, source: { jsonLd: !!findOrgNode(nodes), og: hasOg } };
}

function safeOrigin(url) {
  try { return new URL(url).origin; } catch { return null; }
}

// ── SSRF guard ───────────────────────────────────────────────────────────────
function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true; // link-local
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const lc = ip.toLowerCase();
    return lc === '::1' || lc === '::' || lc.startsWith('fc') || lc.startsWith('fd') || lc.startsWith('fe80') || lc.startsWith('::ffff:');
  }
  return true; // unknown format → treat as unsafe
}

/** Reject non-http(s), loopback names, and hosts that resolve to a private IP
 *  (defends DNS→private rebinding). Throws on unsafe. */
async function assertSafeUrl(url) {
  let u;
  try { u = new URL(url); } catch { throw httpErr('Invalid URL', 400); }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') throw httpErr('Only http(s) URLs are allowed', 400);
  const host = u.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    throw httpErr('Refusing to fetch a private/loopback host', 400);
  }
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw httpErr('Refusing to fetch a private IP', 400);
    return u;
  }
  // Resolve the name and reject if ANY address is private.
  let addrs = [];
  try { addrs = await dns.lookup(host, { all: true }); } catch { throw httpErr('Could not resolve host', 400); }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw httpErr('Host resolves to a private address', 400);
  }
  return u;
}

function httpErr(message, status) {
  const e = new Error(message); e.status = status; return e;
}

// ── guarded fetch + extract ──────────────────────────────────────────────────
/** Fetch the ROOT of the host (JSON-LD Organization is site-level + stable),
 *  with SSRF guard, timeout, redirect cap, and a body-size cap. */
async function extractOrg(inputUrl) {
  const start = await assertSafeUrl(inputUrl);
  const rootUrl = start.origin + '/';
  let current = rootUrl;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    let res;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      res = await fetch(current, {
        redirect: 'manual',
        signal: controller.signal,
        headers: { 'user-agent': 'BallparkOrgImport/1.0 (+https://theballpark.app)', accept: 'text/html' },
      });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
        if (hop === MAX_REDIRECTS) throw httpErr('Too many redirects', 502);
        const next = new URL(res.headers.get('location'), current).toString();
        await assertSafeUrl(next); // re-guard each hop
        current = next;
        continue;
      }
      break;
    }
    if (!res.ok) throw httpErr(`Site returned ${res.status}`, 502);

    // Read with a hard byte cap.
    const reader = res.body?.getReader?.();
    let html = '';
    if (reader) {
      const decoder = new TextDecoder();
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        total += value.length;
        html += decoder.decode(value, { stream: true });
        if (total >= MAX_BODY_BYTES) { try { await reader.cancel(); } catch { /* ignore */ } break; }
      }
      html += decoder.decode();
    } else {
      html = (await res.text()).slice(0, MAX_BODY_BYTES);
    }

    return parseOrgFromHtml(html, { isHomepage: true, url: start.origin });
  } catch (err) {
    if (err.name === 'AbortError') throw httpErr('Site took too long to respond', 504);
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

module.exports = {
  extractOrg,
  parseOrgFromHtml,
  // exported for unit tests
  _internals: { extractJsonLdBlocks, flattenGraph, findOrgNode, extractMeta, assertSafeUrl, isPrivateIp },
};
