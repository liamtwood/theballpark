// Build-time validator: every icon_name written to shared.feedback_categories
// must be a key in client-angular/src/app/core/icons.ts. If a row has an
// unregistered name, the icon won't render and the script exits non-zero.
//
// Usage:
//   npm run check:icons
//
// Connects to whatever DATABASE_URL points at — typically the dev DB.

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const ICONS_TS = path.join(
  __dirname, '..', '..',
  'client-angular', 'src', 'app', 'core', 'icons.ts'
);

// kebab-case → PascalCase, mirroring lucide-angular's toPascalCase regex.
function toPascal(str) {
  return str.replace(/(\w)([a-z0-9]*)(_|-|\s*)/g, (_, g1, g2) => g1.toUpperCase() + g2.toLowerCase());
}

function readRegistryKeys() {
  if (!fs.existsSync(ICONS_TS)) {
    console.error(`ERROR: cannot find ${ICONS_TS}`);
    process.exit(1);
  }
  const src = fs.readFileSync(ICONS_TS, 'utf8');

  // Extract the ICON_REGISTRY object literal. We only care about the property
  // names (keys), not their values, so a flat regex pass is enough.
  const match = src.match(/export const ICON_REGISTRY\s*=\s*\{([\s\S]*?)\}\s*as const;/);
  if (!match) {
    console.error('ERROR: could not parse ICON_REGISTRY from icons.ts');
    process.exit(1);
  }
  const body = match[1];
  // Identifiers separated by , or whitespace. Strip comments.
  const cleaned = body
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '');
  const keys = new Set();
  for (const m of cleaned.matchAll(/[A-Z][A-Za-z0-9]*/g)) {
    keys.add(m[0]);
  }
  return keys;
}

(async () => {
  const registered = readRegistryKeys();
  console.log(`icons.ts registry keys: ${registered.size}`);

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  let bad = 0;
  try {
    const r = await pool.query(
      `SELECT id, name, namespace, icon_name
         FROM shared.feedback_categories
        WHERE icon_name IS NOT NULL AND icon_name <> ''`
    );
    for (const row of r.rows) {
      const pascal = toPascal(row.icon_name);
      if (!registered.has(pascal)) {
        console.error(
          `MISSING: shared.feedback_categories[${row.namespace}/${row.name}] ` +
          `icon_name="${row.icon_name}" → ${pascal}`
        );
        bad++;
      }
    }
    console.log(`checked ${r.rowCount} rows, ${bad} unregistered.`);
  } finally {
    await pool.end();
  }
  if (bad > 0) {
    console.error(`\nFAIL: ${bad} icon name(s) reference symbols not in icons.ts.`);
    console.error(`Add the missing imports + registry entries in client-angular/src/app/core/icons.ts.`);
    process.exit(1);
  }
  console.log('OK — every DB icon_name is registered.');
})();
