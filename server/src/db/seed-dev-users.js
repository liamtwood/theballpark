// pV2-02 — dev user seed. Idempotent; dev (public schema) only.
//
// Creates the four pickable identities the login page's dev picker shows,
// replacing pV2-01b's in-memory STUB_USERS. google_sub stays NULL — that is
// the marker /api/dev/users + /auth/dev/login key on (combined with having
// an active user_orgs membership, which v1's legacy persona rows lack).
//
// Org upsert is BY NAME: 'Rocket Food' already exists in dev data (v1
// supplier) and is intentionally reused; 'Creative Agency Ltd' and
// 'Ballpark' (type 'ballpark') are created if absent.
//
// Usage: npm run seed:dev-users   (from server/)

const { Client } = require('pg');
require('dotenv').config({ path: require('path').join(__dirname, '../../../.env') });

const DEV_USERS = [
  { email: 'sarah@creative-agency.example', displayName: 'Sarah Mitchell',
    orgName: 'Creative Agency Ltd', orgType: 'agency', isAdmin: true },
  { email: 'alex@creative-agency.example', displayName: 'Alex Martin',
    orgName: 'Creative Agency Ltd', orgType: 'agency', isAdmin: false },
  { email: 'beth@ballpark.example', displayName: 'Beth Pizey',
    orgName: 'Ballpark', orgType: 'ballpark', isAdmin: true },
  { email: 'ryan@rocketfood.example', displayName: 'Ryan Chen',
    orgName: 'Rocket Food', orgType: 'supplier', isAdmin: true },
];

(async () => {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log('[seed-dev-users] seeding public schema…');
  try {
    for (const u of DEV_USERS) {
      // Org by name (create with the spec'd type when absent).
      let org = await client.query(
        `SELECT id FROM public.orgs WHERE name = $1 AND deleted_at IS NULL LIMIT 1`, [u.orgName]);
      if (!org.rows.length) {
        org = await client.query(
          `INSERT INTO public.orgs (name, type) VALUES ($1, $2) RETURNING id`,
          [u.orgName, u.orgType]);
        console.log(`  org created: ${u.orgName} (${u.orgType})`);
      }
      const orgId = org.rows[0].id;

      // User by email.
      let user = await client.query(
        `SELECT id FROM public.users WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1`,
        [u.email]);
      if (!user.rows.length) {
        user = await client.query(
          `INSERT INTO public.users (name, display_name, email, default_org_id, role)
           VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [u.displayName, u.displayName, u.email, orgId, u.isAdmin ? 'admin' : 'member']);
        console.log(`  user created: ${u.displayName} <${u.email}>`);
      } else {
        await client.query(
          `UPDATE public.users SET display_name = $2, default_org_id = COALESCE(default_org_id, $3), updated_at = NOW()
            WHERE id = $1`, [user.rows[0].id, u.displayName, orgId]);
      }
      const userId = user.rows[0].id;

      // Membership.
      await client.query(
        `INSERT INTO public.user_orgs (user_id, org_id, is_admin, status, joined_at)
         VALUES ($1, $2, $3, 'active', NOW())
         ON CONFLICT (user_id, org_id)
         DO UPDATE SET is_admin = EXCLUDED.is_admin, status = 'active', updated_at = NOW()`,
        [userId, orgId, u.isAdmin]);
    }
    console.log('[seed-dev-users] done — 4 identities ready for the dev picker.');
  } catch (err) {
    console.error('ERROR:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
})();
