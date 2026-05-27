// v1.65cz (p0013) — brief-as-cards storage.
//
// Additive only; idempotent.
//
//   messages.intro_note      text — agent's optional intro on the first
//                                   brief outreach (rendered in-stream as
//                                   a caption + in the outreach email).
//   messages.tagged_item_id  uuid — free-typed reply tagged to a specific
//                                   message_item (drives the "↳ {item.name}"
//                                   breadcrumb in the bubble).
//
// projects.ref already exists (v1.39 — minted as e.g. WA-014); the
// p0013 prompt's `ref_code` field is an alias. No schema change.
//
// Free-typed message bubbles continue to live in `messages` itself —
// no new message_replies table needed (auditing before adding, per
// the prompt's instructions).
//
// Usage:
//   node server/src/db/migrate-v1.65cz-p0013-brief-cards.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate p0013] start');

  try {
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS intro_note text;`);
    console.log('  ✓ messages.intro_note');
    await client.query(
      `ALTER TABLE messages ADD COLUMN IF NOT EXISTS tagged_item_id uuid REFERENCES message_items(id);`
    );
    console.log('  ✓ messages.tagged_item_id (→ message_items)');
    await client.query(
      `CREATE INDEX IF NOT EXISTS messages_tagged_item_id_idx ON messages(tagged_item_id) WHERE tagged_item_id IS NOT NULL;`
    );
    console.log('  ✓ messages_tagged_item_id_idx');

    console.log('[migrate p0013] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
