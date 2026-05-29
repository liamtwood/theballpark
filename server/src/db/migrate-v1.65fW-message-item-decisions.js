// v1.65fW — per-item per-side decision satellite. Each row records
// a single accept / decline event from one side (buyer = agent;
// seller = supplier), with who clicked + an optional note +
// timestamp. Append-only so we keep full history for future
// "decision timeline" surfaces; the CURRENT decision per side is
// the latest row by created_at.
//
// Why a satellite rather than two columns on message_items:
//   - captures user_id (who clicked)
//   - captures note (optional reason)
//   - extensible to a third side later (approver / client) by
//     adding a new `side` value with no migration
//   - history kept for free; today's UI just reads the latest
//
// Idempotent: CREATE TABLE IF NOT EXISTS. Safe to re-run.
//
// Usage:
//   node server/src/db/migrate-v1.65fW-message-item-decisions.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate v1.65fW] start — message_item_decisions satellite');

  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS message_item_decisions (
        id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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
    console.log('  ✓ table + index created (or already present)');

    console.log('[migrate v1.65fW] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
