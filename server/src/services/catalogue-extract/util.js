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

/** Convert supplier HTML to the small markdown subset the client `md` pipe renders
 *  (bold, italic, bullet lists, paragraphs). Headings become bold lines (the pipe has
 *  no `#` support). Preserves structure instead of flattening — used for DESCRIPTIONS
 *  so they read as formatted text, not one blob. Bounded. */
function htmlToMarkdown(h) {
  let s = String(h || '');
  s = s.replace(/<\s*(h[1-6])[^>]*>/gi, '\n\n**').replace(/<\s*\/\s*h[1-6]\s*>/gi, '**\n\n');
  s = s.replace(/<\s*li[^>]*>/gi, '\n- ').replace(/<\s*\/\s*li\s*>/gi, '');
  s = s.replace(/<\s*\/\s*(ul|ol)\s*>/gi, '\n');
  s = s.replace(/<\s*(strong|b)[^>]*>/gi, '**').replace(/<\s*\/\s*(strong|b)\s*>/gi, '**');
  s = s.replace(/<\s*(em|i)[^>]*>/gi, '*').replace(/<\s*\/\s*(em|i)\s*>/gi, '*');
  s = s.replace(/<\s*br\s*\/?\s*>/gi, '\n');
  s = s.replace(/<\s*\/\s*p\s*>/gi, '\n\n').replace(/<\s*p[^>]*>/gi, '');
  s = s.replace(/<\s*hr[^>]*>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = s.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&pound;/gi, '£')
    .replace(/&#0*39;/g, "'").replace(/&(rsquo|#8217);/gi, "'").replace(/&(ldquo|rdquo|#8220|#8221);/gi, '"')
    .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCharCode(+n); } catch { return ' '; } })
    .replace(/&[a-z]+;/gi, ' ');
  s = s.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return s.slice(0, 4000);
}

module.exports = { normUrl, htmlToPlain, htmlToMarkdown };
