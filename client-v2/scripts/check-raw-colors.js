// pV2-AUDIT-02 fix 5 — raw-color guard, run as part of `npm run lint`.
//
// Tailwind v3 silently IGNORES unknown utility classes rather than failing
// the build, so palette replacement alone makes raw colors inert but not
// loud. This grep makes them a failing check, per WORKING_STANDARDS
// §"Tokens only — enforced at compile time".

const { readFileSync, readdirSync, statSync } = require('node:fs');
const { join } = require('node:path');

const RAW_COLOR =
  /\b(?:hover:|focus:|active:|disabled:)?(?:text|bg|border|ring|from|to|via|fill|stroke)-(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|black|white)(?:-[0-9]+)?(?:\/[0-9]+)?\b|#[0-9a-fA-F]{3,8}\b|rgba?\(/;

const ROOT = join(__dirname, '..', 'src');
// app.config.ts hosts the ONE sanctioned literal palette: the BallparkPreset
// brand ramp bridging --theme-accent into PrimeNG's Aura tokens.
const EXEMPT = [join('app', 'app.config.ts')];
const offenders = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|html)$/.test(name) && !EXEMPT.some((e) => p.endsWith(e))) {
      const lines = readFileSync(p, 'utf8').split('\n');
      lines.forEach((line, i) => {
        // styles.css owns literal values; component files must use tokens.
        if (RAW_COLOR.test(line) && !line.includes('check-raw-colors')) {
          offenders.push(`${p}:${i + 1}: ${line.trim().slice(0, 100)}`);
        }
      });
    }
  }
}

walk(ROOT);

if (offenders.length) {
  console.error(`✖ raw color values found (${offenders.length}) — use tokens (WORKING_STANDARDS §Tokens only):`);
  offenders.forEach((o) => console.error('  ' + o));
  process.exit(1);
}
console.log('✓ no raw color values in src/ component files');
