// v1.65cu (p0008) — Conversation pattern data spine.
//
// Creates the per-item lifecycle tables, augments messages with token
// + thread-level clock + supplier contact/ref, seeds the five new
// codelists, and backfills tokens for any existing message rows so
// the public /brief/:token route works from day one.
//
// Idempotent. Usage:
//   node server/src/db/migrate-v1.65cu-p0008-conversation.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[migrate p0008] start');

  try {
    // ── 1. message_items — additive migration over the existing table
    //     A v1.x message_items already exists (id / message_id / name /
    //     description / price / item_id / accepted / accepted_at) backing
    //     the old quoted-items UI. We add the p0008 columns, keep the
    //     legacy ones for backward compat, and backfill `status` from
    //     `accepted`. Nothing is dropped.
    await client.query(`CREATE TABLE IF NOT EXISTS message_items (
      id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      message_id  uuid NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      created_at  timestamptz NOT NULL DEFAULT now()
    );`); // safety net — only runs when the table doesn't exist at all.

    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS item_id        uuid REFERENCES items(id);`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS name           text;`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS description    text;`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS price_ref      numeric(12,2);`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS price_current  numeric(12,2);`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS unit           text;`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS status         text NOT NULL DEFAULT 'brief_sent';`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS adjusted_by    text;`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS decline_reason text;`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS decline_note   text;`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS next_action_by timestamptz;`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS metadata       jsonb DEFAULT '{}'::jsonb;`);
    await client.query(`ALTER TABLE message_items ADD COLUMN IF NOT EXISTS updated_at     timestamptz NOT NULL DEFAULT now();`);

    // Backfill: legacy rows had `accepted` boolean + `price`. Map to
    // 'accepted'/'brief_sent' + populate price_current.
    await client.query(`
      UPDATE message_items
         SET status        = CASE WHEN accepted IS TRUE THEN 'accepted' ELSE 'brief_sent' END,
             price_current = COALESCE(price_current, price),
             price_ref     = COALESCE(price_ref,     price)
       WHERE status = 'brief_sent' AND (price_current IS NULL OR price_ref IS NULL);
    `);

    await client.query(`CREATE INDEX IF NOT EXISTS message_items_message_id_idx ON message_items(message_id);`);
    await client.query(`CREATE INDEX IF NOT EXISTS message_items_status_idx     ON message_items(status);`);
    console.log('  ✓ message_items table (additive)');

    await client.query(`
      CREATE TABLE IF NOT EXISTS message_item_events (
        id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        message_item_id uuid NOT NULL REFERENCES message_items(id) ON DELETE CASCADE,
        from_status     text,
        to_status       text NOT NULL,
        actor_type      text NOT NULL,
        actor_id        uuid,
        reason_code     text,
        note            text,
        price_before    numeric(12,2),
        price_after     numeric(12,2),
        created_at      timestamptz NOT NULL DEFAULT now()
      );
    `);
    await client.query(`CREATE INDEX IF NOT EXISTS message_item_events_item_idx ON message_item_events(message_item_id);`);
    console.log('  ✓ message_item_events table');

    // ── 2. messages columns ─────────────────────────────────────────
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS token          text;`);
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS next_action_by timestamptz;`);
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS contact_name   text;`);
    await client.query(`ALTER TABLE messages ADD COLUMN IF NOT EXISTS ref_code       text;`);
    // Unique only when present — partial index so legacy NULL rows don't collide.
    await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS messages_token_uidx ON messages(token) WHERE token IS NOT NULL;`);
    console.log('  ✓ messages.token / next_action_by / contact_name / ref_code');

    // ── 3. Backfill tokens ──────────────────────────────────────────
    const backfill = await client.query(`
      UPDATE messages
         SET token = replace(gen_random_uuid()::text, '-', '')
       WHERE token IS NULL
       RETURNING id
    `);
    console.log(`  ✓ token backfill: ${backfill.rowCount} rows`);

    // ── 4. Codelists ────────────────────────────────────────────────
    // 4.1 message_item_status — 9 codes. Meta carries the semantic
    //     token key so the client doesn't have to keep a map in sync.
    await client.query(`
      INSERT INTO shared.codelists (list_name, code, label, sort_order, meta, is_system) VALUES
        ('message_item_status', 'brief_sent',           'Brief Sent',  1, '{"semantic":"waiting","terminal":false}'::jsonb, true),
        ('message_item_status', 'holding',              'Holding',     2, '{"semantic":"waiting","terminal":false}'::jsonb, true),
        ('message_item_status', 'quoted',               'Quoted',      3, '{"semantic":"quoted","terminal":false}'::jsonb,  true),
        ('message_item_status', 'adjusted_by_supplier', 'Adjusted',    4, '{"semantic":"quoted","terminal":false}'::jsonb,  true),
        ('message_item_status', 'adjusted_by_agent',    'Adjusted',    5, '{"semantic":"waiting","terminal":false}'::jsonb, true),
        ('message_item_status', 'accepted',             'Accepted',    6, '{"semantic":"action","terminal":false}'::jsonb,  true),
        ('message_item_status', 'booked',               'Booked',      7, '{"semantic":"booked","terminal":true}'::jsonb,   true),
        ('message_item_status', 'declined_by_supplier', 'Declined',    8, '{"semantic":"danger","terminal":true}'::jsonb,   true),
        ('message_item_status', 'declined_by_agent',    'Cancelled',   9, '{"semantic":"danger","terminal":true}'::jsonb,   true)
      ON CONFLICT (list_name, code) DO NOTHING;
    `);
    console.log('  ✓ codelist: message_item_status');

    // 4.3 decline_reason_pre_agreement
    await client.query(`
      INSERT INTO shared.codelists (list_name, code, label, sort_order, meta, is_system) VALUES
        ('decline_reason_pre_agreement', 'dates_unavailable', 'Dates don''t work',          1, '{"who":"both"}'::jsonb,     true),
        ('decline_reason_pre_agreement', 'item_unavailable',  'Item not available',         2, '{"who":"both"}'::jsonb,     true),
        ('decline_reason_pre_agreement', 'price_too_high',    'Price too high',             3, '{"who":"agent"}'::jsonb,    true),
        ('decline_reason_pre_agreement', 'spec_mismatch',     'Doesn''t meet requirements', 4, '{"who":"agent"}'::jsonb,    true),
        ('decline_reason_pre_agreement', 'out_of_scope',      'Outside our service area',   5, '{"who":"supplier"}'::jsonb, true),
        ('decline_reason_pre_agreement', 'other',             'Other',                      6, '{"who":"both","requires_note":true}'::jsonb, true)
      ON CONFLICT (list_name, code) DO NOTHING;
    `);
    console.log('  ✓ codelist: decline_reason_pre_agreement');

    // 4.4 decline_reason_post_agreement
    await client.query(`
      INSERT INTO shared.codelists (list_name, code, label, sort_order, meta, is_system) VALUES
        ('decline_reason_post_agreement', 'event_cancelled',          'Event cancelled',           1, '{"who":"both"}'::jsonb,  true),
        ('decline_reason_post_agreement', 'item_no_longer_available', 'Item no longer available',  2, '{"who":"both"}'::jsonb,  true),
        ('decline_reason_post_agreement', 'price_changed',            'Price has changed',         3, '{"who":"both"}'::jsonb,  true),
        ('decline_reason_post_agreement', 'client_changed_mind',      'Plans changed',             4, '{"who":"agent"}'::jsonb, true),
        ('decline_reason_post_agreement', 'other',                    'Other',                     5, '{"who":"both","requires_note":true}'::jsonb, true)
      ON CONFLICT (list_name, code) DO NOTHING;
    `);
    console.log('  ✓ codelist: decline_reason_post_agreement');

    // 4.5 quick_reply_templates
    await client.query(`
      INSERT INTO shared.codelists (list_name, code, label, sort_order, meta, is_system) VALUES
        ('quick_reply_templates', 'agent_thanks',     'Thanks!',                    1, '{"direction":"agent_to_supplier","body":"Thanks!"}'::jsonb,                                                                  true),
        ('quick_reply_templates', 'agent_confirm',    'Can you confirm?',           2, '{"direction":"agent_to_supplier","body":"Can you confirm the details before we proceed?"}'::jsonb,                            true),
        ('quick_reply_templates', 'agent_reviewing',  'We''ll review',              3, '{"direction":"agent_to_supplier","body":"Thanks — we''ll review and come back to you {next_action_by}."}'::jsonb,            true),
        ('quick_reply_templates', 'agent_other_path', 'Going with another option', 4, '{"direction":"agent_to_supplier","body":"Thanks for the quote — we''re going with another option this time."}'::jsonb,        true),
        ('quick_reply_templates', 'sup_received',     'Thanks, received',           1, '{"direction":"supplier_to_agent","body":"Thanks Sarah — received, taking a look now."}'::jsonb,                                true),
        ('quick_reply_templates', 'sup_working',      'Working on it',              2, '{"direction":"supplier_to_agent","body":"Working on it — back to you {next_action_by}."}'::jsonb,                              true),
        ('quick_reply_templates', 'sup_confirmed',    'Confirmed as-is',            3, '{"direction":"supplier_to_agent","body":"Confirmed — we can do this as briefed for the price shown."}'::jsonb,                  true),
        ('quick_reply_templates', 'sup_need_detail',  'Need a bit more detail',     4, '{"direction":"supplier_to_agent","body":"Could we get a bit more detail before we quote?"}'::jsonb,                            true)
      ON CONFLICT (list_name, code) DO NOTHING;
    `);
    console.log('  ✓ codelist: quick_reply_templates');

    // 4.2 message_status is COMPUTED, not stored — no codelist needed
    //     beyond the existing semantic colour tokens already in use.

    console.log('[migrate p0008] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
