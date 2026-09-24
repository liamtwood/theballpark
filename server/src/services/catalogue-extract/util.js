// pV2-STORE-PROFILES-01 — shared leaf primitives for the catalogue-extract service
// and its profile modules. Pure, dependency-free (no db, no fetch) so the profile
// modules can import them without a cycle back into the main service.

/** Canonical URL form for dedup/grouping: drop the fragment and a trailing slash. */
const normUrl = (u) => String(u).split('#')[0].replace(/\/$/, '');

/** Strip HTML to clean prose + decode the common entities (Woo/WP descriptions and
 *  category names arrive as HTML). Bounded to keep prompts / rows small. */
function htmlToPlain(h) {
  return String(h || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&pound;/gi, '£')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(+n); } catch { return ' '; } })
    .replace(/&[a-z]+;/gi, ' ').replace(/\s+/g, ' ').trim().slice(0, 2000);
}

module.exports = { normUrl, htmlToPlain };
