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

// RP-05 (chat audit 2026-06-12): .bp-* class DEFINITIONS belong in
// styles.css only (one-definition rule) — a `.bp-foo {` selector inside a
// component's styles block makes the inventory untrackable and reuse
// impossible. Consumption is fine (class="bp-foo", [class.bp-foo]=,
// :host(.bp-foo)) — this matches only selector-position definitions.
const BP_CLASS_DEF = /^\s*\.bp-[a-z0-9_-]/;

// RP-07 (pV2-CARDS-01): card CHROME declarations belong to .bp-card in
// styles.css — a component declaring the card radius or a shadow token in
// its own styles block is re-deriving chrome (CARDS.md one-definition).
// Consume `.bp-card` (+ modifiers) instead.
const CARD_CHROME = /border-radius:\s*var\(--radius-card\)|box-shadow:\s*var\(--shadow-/;
// Ratchet allowlist: pre-RP-05 components carrying BEM-element classes
// (.bp-<component>__el). Shrink this list, never grow it.
const BP_DEF_LEGACY = [
  join('shared', 'edit-field', 'edit-field.component.ts'),
  join('shared', 'launcher', 'home-launcher.component.ts'),
  join('shared', 'launcher', 'launcher-tile.component.ts'),
  join('shell', 'page-hero', 'page-hero.component.ts'),
];

const ROOT = join(__dirname, '..', 'src');
// app.config.ts hosts the ONE sanctioned literal palette (BallparkPreset).
// welcome.component.ts is the public marketing deck — DELIBERATELY outside the
// design system (inline brand colours, no PrimeNG, no theme vars; a locked
// visual recipe ported verbatim from v1). Exempt by design.
const EXEMPT = [
  join('app', 'app.config.ts'),
  join('app', 'public', 'welcome', 'welcome.component.ts'),
];
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
        if (name.endsWith('.ts') && !BP_DEF_LEGACY.some((e) => p.endsWith(e))) {
          check(line, p, i, BP_CLASS_DEF, 'RP-05 .bp-* defined outside styles.css');
        }
        if (name.endsWith('.ts')) {
          check(line, p, i, CARD_CHROME, 'RP-07 card chrome outside styles.css — consume .bp-card');
        }
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
