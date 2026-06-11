// v1.65e9 (p0015) — seed persona user records.
//
// Creates one user per persona, each pinned to the right org. Mirrors
// the PersonaService.PERSONAS array on the client (core/services/
// persona.service.ts).
//
//   sarah@woodland.test  → Sarah Mitchell  · Woodland Agency · admin
//   beth@ballpark.test   → Beth Pizey      · Ballpark        · admin
//   ryan@rocketfood.test → Ryan Foster     · Rocket Food     · admin
//
// Idempotent: ON CONFLICT (lower(email)) WHERE deleted_at IS NULL
// DO UPDATE so re-running just patches the name/org/role if anything
// drifted. (v2.07a QC fix: targets the partial users_email_uidx — the legacy
// users_email_key constraint was dropped so soft-deleted users can
// re-sign-up.)
//
// Usage:
//   node server/src/db/seed-v1.65e9-persona-users.js

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const ORG_IDS = {
  woodland:   'b9025772-1723-4f95-a056-add54eebd100',
  ballpark:   'de4258e7-6694-4c76-b548-9ab958b4dda0',
  rocketfood: '5488cde0-ba0d-48a2-a599-d00d04aa655e',
};

const PERSONA_USERS = [
  { email: 'sarah@woodland.test',  name: 'Sarah Mitchell', org_id: ORG_IDS.woodland,   role: 'admin' },
  { email: 'beth@ballpark.test',   name: 'Beth Pizey',     org_id: ORG_IDS.ballpark,   role: 'admin' },
  { email: 'ryan@rocketfood.test', name: 'Ryan Foster',    org_id: ORG_IDS.rocketfood, role: 'admin' },
];

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });
  await client.connect();
  console.log('[seed v1.65e9] start — persona users');

  try {
    // Verify all three orgs exist before we try to attach users.
    const orgCheck = await client.query(
      `SELECT id, name FROM orgs WHERE id = ANY($1::uuid[]) ORDER BY name`,
      [Object.values(ORG_IDS)]
    );
    if (orgCheck.rows.length !== 3) {
      console.error('Expected 3 orgs, found:', orgCheck.rows.length);
      console.error('Rows:', orgCheck.rows);
      console.error('Re-run after creating Ballpark via /ballpark-settings/orgs.');
      process.exit(1);
    }
    console.log('  ✓ all 3 orgs present:', orgCheck.rows.map(r => r.name).join(', '));

    for (const u of PERSONA_USERS) {
      const r = await client.query(
        `INSERT INTO users (email, name, org_id, role, is_active)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (lower(email)) WHERE deleted_at IS NULL DO UPDATE
           SET name = EXCLUDED.name,
               org_id = EXCLUDED.org_id,
               role = EXCLUDED.role,
               is_active = true,
               updated_at = NOW()
         RETURNING id, name, email, org_id, role`,
        [u.email, u.name, u.org_id, u.role]
      );
      const row = r.rows[0];
      console.log(`  ✓ ${row.name.padEnd(15)} (${row.email}) → org_id ${row.org_id} [${row.role}]`);
    }

    console.log('[seed v1.65e9] done.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
