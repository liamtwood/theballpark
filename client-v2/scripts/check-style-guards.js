// Style guards, run as part of `npm run lint`.
//   1. Raw colors (pV2-AUDIT-02 fix 5) — Tailwind v3 silently IGNORES unknown
//      utility classes rather than failing the build, so palette replacement
//      alone makes raw colors inert but not loud. This grep makes them a
//      failing check (ENGINEERING.md Rule 2).
//   2. Typography (pV2-TYPE-01) — styles.css + the BallparkPreset are the
//      ONLY legal sites for font-family / literal font-size. Components may
//      reference the family/size TOKENS (var(--bp-font), var(--font-*),
//      var(--text-*)) but never literals; arbitrary Tailwind text-[Npx]
//      fails too (the mapped scale or a .bp-* type class replaces it).
//      Dynamic template bindings ([style.font-size.px]) are the sanctioned
//      runtime exception (DESIGN.md inline-style exceptions) — they don't
//      match the CSS-declaration patterns below.

const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

const RAW_COLOR =
  /\b(?:hover:|focus:|active:|disabled:)?(?:text|bg|border|ring|from|to|via|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-[0-9]+)?(?:\/[0-9]+)?\b|#[0-9a-fA-F]{3,8}\b|rgba?\(/;

// font-family value must be EXACTLY a family token (capture-then-check —
// a lookahead after \s* backtracks and false-positives on token refs).
function fontFamilyViolation(line) {
  const m = line.match(/font-family:\s*([^;'"`]+)/);
  return !!m && !/^var\(--(?:bp-font|font-[a-z-]+)\)$/.test(m[1].trim());
}
// font-size: <literal units> (var(--text-*) refs are allowed)
const FONT_SIZE_LITERAL = /font-size:\s*[0-9.]+(?:px|rem|em|%)/;
// Tailwind arbitrary size utility
const TEXT_ARBITRARY = /\btext-\[[0-9.]+(?:px|rem|em)\]/;

const ROOT = join(__dirname, '..', 'src');
// app.config.ts hosts the ONE sanctioned literal palette (BallparkPreset).
const EXEMPT = [join('app', 'app.config.ts')];
const offenders = [];

function check(line, file, i, pattern, label) {
  if (pattern.test(line)) {
    offenders.push(`${file}:${i + 1}: [${label}] ${line.trim().slice(0, 100)}`);
  }
}

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|html)$/.test(name) && !EXEMPT.some((e) => p.endsWith(e))) {
      const lines = readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // styles.css owns literal values; component files must use tokens.
        if (line.includes('check-style-guards')) return;
        check(line, p, i, RAW_COLOR, 'raw color');
        if (fontFamilyViolation(line)) {
          offenders.push(`${p}:${i + 1}: [font-family outside styles.css] ${line.trim().slice(0, 100)}`);
        }
        check(line, p, i, FONT_SIZE_LITERAL, 'literal font-size');
        check(line, p, i, TEXT_ARBITRARY, 'arbitrary text-[N]');
      });
    }
  }
}

walk(ROOT);

if (offenders.length) {
  console.error(`✖ style-guard violations (${offenders.length}) — tokens only (ENGINEERING.md Rule 2 / pV2-TYPE-01):`);
  offenders.forEach((o) => console.error('  ' + o));
  process.exit(1);
}
console.log('✓ style guards clean (colors + typography) in src/ component files');
