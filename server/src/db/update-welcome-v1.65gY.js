/**
 * v1.65gY — sync marketing.welcome_content to the client design
 * review pass. Updates existing rows + inserts the three new keys
 * (suppliers.subtitle, hero.cta, guestlist.footer_text).
 *
 * The marketing schema is GLOBAL (one Supabase DB instance shared
 * across dev/preview/prod — see WORKING_STANDARDS). Running this
 * once updates the welcome page copy for every environment.
 *
 * Usage:
 *   node server/src/db/update-welcome-v1.65gY.js
 *
 * Idempotent — re-running writes the same values back.
 */
const { Client } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../..', '.env') });

// [key, value, field_type, label, help_text, slide, display_order]
const ROWS = [
  // ── changed values ─────────────────────────────────────────────
  ['hero.headline',          'REAL COSTS\nREAL FAST',                                                        'longtext', 'Headline',     'Use \\n for line breaks', 1, 20],
  ['hero.subtitle',          'Turn your event into an accurate estimate in moments.',                        'longtext', 'Subtitle',     null,                      1, 30],
  ['suppliers.headline',     'AI Powered by real costs from our network of incredible suppliers.',           'longtext', 'Headline',     null,                      2, 20],
  ['producers.tagline',      'By producers for creators',                                                    'text',     'Italic tagline', null,                    3, 20],
  ['guestlist.headline',     'THOSE WHO GET IN EARLY,\nGET AHEAD',                                           'longtext', 'Headline',     'Use \\n for line breaks',  4, 20],
  ['guestlist.cta_label',    'APPLY',                                                                        'text',     'Submit button label', null,                4, 40],
  // ── new keys (not in original seed) ────────────────────────────
  ['hero.cta',               'Get on the guestlist',                                                         'text',     'Hero CTA label', null,                    1, 40],
  ['suppliers.subtitle',     'The best suppliers in the UK with quotes in minutes.',                         'longtext', 'Subtitle',     null,                      2, 25],
  ['guestlist.footer_text',  "Get on the guestlist and the moment we're live you'll be the first to know.",  'longtext', 'Footer text below form', null,             4, 35],
];

(async () => {
  const conn = process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!conn) {
    console.error('No DIRECT_URL / DATABASE_URL in env. Aborting.');
    process.exit(1);
  }

  const client = new Client({ connectionString: conn, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log('[update-welcome] connected. Updating marketing.welcome_content...');

  for (const [key, value, field_type, label, help, slide, order] of ROWS) {
    const res = await client.query(
      `INSERT INTO marketing.welcome_content
         (key, value, field_type, label, help_text, slide, display_order)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (key) DO UPDATE
         SET value         = EXCLUDED.value,
             field_type    = EXCLUDED.field_type,
             label         = EXCLUDED.label,
             help_text     = EXCLUDED.help_text,
             slide         = EXCLUDED.slide,
             display_order = EXCLUDED.display_order,
             updated_at    = NOW()
       RETURNING key`,
      [key, value, field_type, label, help, slide, order]
    );
    console.log(`  ✓ ${res.rows[0].key}`);
  }

  await client.end();
  console.log('[update-welcome] done.');
})().catch(err => {
  console.error('[update-welcome] FAILED:', err.message);
  process.exit(1);
});
