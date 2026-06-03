// One-off preview-targeted runner for v1.65fW. The vanilla migration
// hits "function uuid_generate_v4() does not exist" against preview
// Railway because the connection lands without uuid-ossp in scope.
// This wrapper:
//   1. Sets search_path explicitly on the connection
//   2. Ensures the uuid-ossp extension is installed in public
//   3. Then runs the original CREATE TABLE block
const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env.preview') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[v1.65fW-preview] connected');

  try {
    // Combine SET search_path + DDL into ONE query so pgbouncer
    // transaction-mode doesn't strip the search_path between calls.
    // Use gen_random_uuid() (built-in to PG13+) instead of
    // uuid_generate_v4() — no extension dependency.
    await client.query(`
      SET search_path TO preview, public;
      CREATE TABLE IF NOT EXISTS message_item_decisions (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        message_item_id UUID NOT NULL REFERENCES message_items(id) ON DELETE CASCADE,
        side            VARCHAR(20) NOT NULL,
        decision        VARCHAR(20) NOT NULL,
        user_id         UUID REFERENCES users(id),
        note            TEXT,
        created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS ix_mid_latest
        ON message_item_decisions(message_item_id, side, created_at DESC);
    `);
    console.log('  ✓ message_item_decisions table + index created');
    console.log('[v1.65fW-preview] done.');
  } catch (err) {
    console.error('ERROR:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
