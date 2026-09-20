/**
 * pV2-SECURITY-RLS-01 §1 (FR-00209) — Row-Level Security migration.
 *
 * Creates the non-owner app role `web_app_user`, the GUC helper functions, the
 * per-schema membership helpers (SECURITY DEFINER), the scoped grants, the full
 * tenant policy set, and the `orgs_public` view — across every present env schema
 * (public / preview / master).
 *
 * IDEMPOTENT: safe to run repeatedly (CREATE OR REPLACE fns/views; DROP POLICY
 * IF EXISTS + CREATE; role via a pg_roles guard; GRANT/ENABLE are idempotent).
 *
 * INERT UNTIL THE ROLE FLIP: the app still connects as the schema OWNER
 * (DATABASE_URL), which BYPASSES RLS — so applying this changes NO behaviour.
 * Enforcement begins only when DATABASE_URL is pointed at web_app_user (a
 * separate step Liam runs AFTER the 3-persona tests are green — see the shipped
 * doc rollout order). Migrations keep using the owner (MIGRATION_DATABASE_URL).
 *
 * WHY STANDALONE (not folded into migrate-schemas.js): that file fatals partway
 * (~line 2139, BE-00095), so a full run never completes — this needs to apply
 * end-to-end and be independently re-runnable/verifiable. Fold into
 * migrate-schemas.js (early, before the fatal) once BE-00095 is fixed.
 *
 * RUN (owner connection): WEB_APP_PW=<pw> node src/db/migrate-rls.js
 *   Uses MIGRATION_DATABASE_URL || DIRECT_URL || DATABASE_URL (must be the OWNER).
 *   WEB_APP_PW is required to (re)set the role's password.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env'), override: true });
const { Pool } = require('pg');

const ENV_SCHEMAS = ['public', 'preview', 'master'];

// Enumerated tenant tables that web_app_user is granted + policied. A table NOT
// in this set is left owner-only (unreachable by the app role — the primary
// guard for no-tenant surfaces). If a v2 feature breaks under web_app_user in
// step-4 testing, its table is missing here: add it with the right archetype
// (fail-closed today — deny-all, never a leak). Coverage test asserts
// granted == policied, so this list and the policy set below can't drift.
const READ_ONLY_SHARED = {
  shared: ['reference_codelists', 'reference_codelist_values', 'feedback_categories'],
  marketing: ['welcome_content'],
};

function quoteLiteral(s) { return "'" + String(s).replace(/'/g, "''") + "'"; }

// ── SQL builders ────────────────────────────────────────────────────────────

/** public GUC readers — no table access, search_path pinned to pg_catalog. */
const PUBLIC_FUNCS = `
CREATE OR REPLACE FUNCTION public.app_current_org() RETURNS uuid
  LANGUAGE sql STABLE SET search_path = pg_catalog
  AS $$ SELECT NULLIF(current_setting('app.current_org_id', true), '')::uuid $$;
CREATE OR REPLACE FUNCTION public.app_is_admin() RETURNS boolean
  LANGUAGE sql STABLE SET search_path = pg_catalog
  AS $$ SELECT COALESCE(current_setting('app.is_admin', true), 'f')::boolean $$;
CREATE OR REPLACE FUNCTION public.app_current_user_id() RETURNS uuid
  LANGUAGE sql STABLE SET search_path = pg_catalog
  AS $$ SELECT NULLIF(current_setting('app.current_user_id', true), '')::uuid $$;
REVOKE EXECUTE ON FUNCTION public.app_current_org(), public.app_is_admin(), public.app_current_user_id() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.app_current_org(), public.app_is_admin(), public.app_current_user_id() TO web_app_user;
`;

/** Per-schema SECURITY DEFINER membership helpers (owned by the schema owner so
 *  they bypass RLS on the inner lookup — this is what avoids the
 *  projects↔project_items policy recursion). search_path pinned to the schema. */
function membershipFuncs(s) {
  return `
CREATE OR REPLACE FUNCTION ${s}.app_owns_project(pid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ${s}, pg_catalog AS $$
    SELECT EXISTS (SELECT 1 FROM projects WHERE id = pid AND org_id = public.app_current_org()) $$;
CREATE OR REPLACE FUNCTION ${s}.app_is_project_supplier(pid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ${s}, pg_catalog AS $$
    SELECT EXISTS (SELECT 1 FROM project_items
                    WHERE project_id = pid AND supplier_org_id = public.app_current_org() AND deleted_at IS NULL) $$;
CREATE OR REPLACE FUNCTION ${s}.app_is_org_admin(oid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ${s}, pg_catalog AS $$
    SELECT EXISTS (SELECT 1 FROM user_orgs
                    WHERE user_id = public.app_current_user_id() AND org_id = oid
                      AND is_admin = true AND status = 'active' AND deleted_at IS NULL) $$;
-- Access to a project_items ROW (agency-owns-project OR the line's supplier OR
-- admin) — for the message_* junctions + project_item_suppliers that only carry
-- project_item_id.
CREATE OR REPLACE FUNCTION ${s}.app_can_access_project_item(piid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ${s}, pg_catalog AS $$
    SELECT EXISTS (
      SELECT 1 FROM project_items pi JOIN projects p ON p.id = pi.project_id
       WHERE pi.id = piid AND pi.deleted_at IS NULL
         AND (p.org_id = public.app_current_org() OR pi.supplier_org_id = public.app_current_org())) $$;
-- Agency owns the estimate's project (estimate_items only carries estimate_id).
CREATE OR REPLACE FUNCTION ${s}.app_owns_estimate(eid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ${s}, pg_catalog AS $$
    SELECT EXISTS (SELECT 1 FROM estimates e JOIN projects p ON p.id = e.project_id
                    WHERE e.id = eid AND p.org_id = public.app_current_org()) $$;
-- Item belongs to the caller's org (for supplier_item_tag writes).
CREATE OR REPLACE FUNCTION ${s}.app_owns_item(iid uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = ${s}, pg_catalog AS $$
    SELECT EXISTS (SELECT 1 FROM items WHERE id = iid AND org_id = public.app_current_org()) $$;
REVOKE EXECUTE ON FUNCTION ${s}.app_owns_project(uuid), ${s}.app_is_project_supplier(uuid),
  ${s}.app_is_org_admin(uuid), ${s}.app_can_access_project_item(uuid), ${s}.app_owns_estimate(uuid),
  ${s}.app_owns_item(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION ${s}.app_owns_project(uuid), ${s}.app_is_project_supplier(uuid),
  ${s}.app_is_org_admin(uuid), ${s}.app_can_access_project_item(uuid), ${s}.app_owns_estimate(uuid),
  ${s}.app_owns_item(uuid) TO web_app_user;
`;
}

// Policy definitions per table: [table, [ {name, cmd, using?, check?}, ... ] ].
// cmd = SELECT | INSERT | UPDATE | DELETE | ALL. Predicates reference the helpers
// unqualified (resolved via the app's search_path <schema>,public) except the
// public.app_* GUC readers which are always schema-qualified.
const TWO_PARTY_PI = `(public.app_is_admin() OR supplier_org_id = public.app_current_org() OR app_owns_project(project_id))`;
const OWN_ORG = `(org_id = public.app_current_org() OR public.app_is_admin())`;
const ADMIN = `public.app_is_admin()`;

function tenantPolicies(s) {
  const P = [];
  const add = (table, name, cmd, using, check) => P.push({ table, name, cmd, using, check });

  // PUBLIC-CATALOGUE — items
  add('items', 'items_read', 'SELECT', `(approval_status = 'approved' OR org_id = public.app_current_org() OR public.app_is_admin())`, null);
  add('items', 'items_insert', 'INSERT', null, OWN_ORG);
  add('items', 'items_update', 'UPDATE', OWN_ORG, OWN_ORG);
  add('items', 'items_delete', 'DELETE', OWN_ORG, null);

  // TENANT-PRIVATE — projects (read incl. the line's supplier for inbox context)
  add('projects', 'projects_read', 'SELECT', `(org_id = public.app_current_org() OR public.app_is_admin() OR app_is_project_supplier(id))`, null);
  add('projects', 'projects_write', 'ALL', OWN_ORG, OWN_ORG);
  add('clients', 'clients_all', 'ALL', OWN_ORG, OWN_ORG);
  add('favourites', 'favourites_all', 'ALL', OWN_ORG, OWN_ORG);

  // TWO-PARTY — project_items + the inbox family
  add('project_items', 'project_items_all', 'ALL', TWO_PARTY_PI, TWO_PARTY_PI);
  add('messages', 'messages_all', 'ALL', TWO_PARTY_PI, TWO_PARTY_PI);
  add('quote_requests', 'quote_requests_all', 'ALL', TWO_PARTY_PI, TWO_PARTY_PI);
  // via project (project_id, no supplier col on the row itself)
  const VIA_PROJECT = `(public.app_is_admin() OR app_owns_project(project_id) OR app_is_project_supplier(project_id))`;
  const VIA_PROJECT_W = `(public.app_is_admin() OR app_owns_project(project_id))`;
  add('project_categories', 'project_categories_read', 'SELECT', VIA_PROJECT, null);
  add('project_categories', 'project_categories_write', 'ALL', VIA_PROJECT_W, VIA_PROJECT_W);
  add('estimates', 'estimates_read', 'SELECT', VIA_PROJECT, null);
  add('estimates', 'estimates_write', 'ALL', VIA_PROJECT_W, VIA_PROJECT_W);
  add('ai_search_hints', 'ai_search_hints_all', 'ALL', VIA_PROJECT_W, VIA_PROJECT_W);
  // estimate_items — supplier via supplier_org_id, agency via the estimate's project
  const EST_ITEM = `(public.app_is_admin() OR supplier_org_id = public.app_current_org() OR app_owns_estimate(estimate_id))`;
  add('estimate_items', 'estimate_items_all', 'ALL', EST_ITEM, EST_ITEM);
  // junctions with only project_item_id → parent-access helper
  const VIA_PI = `app_can_access_project_item(project_item_id)`;
  add('message_items', 'message_items_all', 'ALL', VIA_PI, VIA_PI);
  add('message_item_events', 'message_item_events_all', 'ALL', VIA_PI, VIA_PI);
  add('message_item_decisions', 'message_item_decisions_all', 'ALL', VIA_PI, VIA_PI);
  const PIS = `(public.app_is_admin() OR supplier_org_id = public.app_current_org() OR app_can_access_project_item(project_item_id))`;
  add('project_item_suppliers', 'project_item_suppliers_all', 'ALL', PIS, PIS);

  // PER-USER — users, user_orgs (anti-self-escalation)
  add('users', 'users_read', 'SELECT', `(id = public.app_current_user_id() OR org_id = public.app_current_org() OR public.app_is_admin())`, null);
  add('users', 'users_write', 'UPDATE', `(id = public.app_current_user_id() OR public.app_is_admin())`, `(id = public.app_current_user_id() OR public.app_is_admin())`);
  add('user_orgs', 'user_orgs_read', 'SELECT', `(user_id = public.app_current_user_id() OR app_is_org_admin(org_id) OR public.app_is_admin())`, null);
  add('user_orgs', 'user_orgs_write', 'ALL', `(public.app_is_admin() OR app_is_org_admin(org_id))`, `(public.app_is_admin() OR (app_is_org_admin(org_id) AND user_id <> public.app_current_user_id()))`);

  // RESOLVED — orgs (base private; shopfront via orgs_public view)
  add('orgs', 'orgs_self', 'ALL', `(id = public.app_current_org() OR public.app_is_admin())`, `(id = public.app_current_org() OR public.app_is_admin())`);
  // balls_transactions — counterparty read; NO write policy (owner/service only)
  add('balls_transactions', 'balls_read', 'SELECT', `(org_id = public.app_current_org() OR supplier_org_id = public.app_current_org() OR public.app_is_admin())`, null);

  // SHARED-REFERENCE — open read, admin write
  for (const t of ['categories', 'statuses', 'tag']) {
    add(t, `${t}_read`, 'SELECT', 'true', null);
    add(t, `${t}_insert`, 'INSERT', null, ADMIN);
    add(t, `${t}_update`, 'UPDATE', ADMIN, ADMIN);
    add(t, `${t}_delete`, 'DELETE', ADMIN, null);
  }
  // supplier_item_tag — open read, write scoped to the item's org (or admin)
  add('supplier_item_tag', 'supplier_item_tag_read', 'SELECT', 'true', null);
  const SIT_W = `(public.app_is_admin() OR app_owns_item(item_id))`;
  add('supplier_item_tag', 'supplier_item_tag_write', 'ALL', SIT_W, SIT_W);

  return P;
}

// Tables granted SELECT/INSERT/UPDATE/DELETE to web_app_user in an env schema.
function grantedTenantTables() {
  return [
    'items', 'projects', 'project_items', 'project_categories', 'estimates', 'estimate_items',
    'clients', 'favourites', 'messages', 'quote_requests', 'message_items', 'message_item_events',
    'message_item_decisions', 'project_item_suppliers', 'users', 'user_orgs', 'orgs',
    'balls_transactions', 'categories', 'statuses', 'tag', 'supplier_item_tag', 'ai_search_hints',
  ];
}

const ORGS_PUBLIC_VIEW = (s) => `
CREATE OR REPLACE VIEW ${s}.orgs_public AS
  SELECT id, name, logo_url, cover_image_url, images, city, country, description
    FROM ${s}.orgs
   WHERE type = 'supplier' AND is_active AND deleted_at IS NULL;
GRANT SELECT ON ${s}.orgs_public TO web_app_user;
`;

async function applySchema(client, s) {
  // Helpers first (policies depend on them).
  await client.query(membershipFuncs(s));
  // Schema + sequence usage; explicit per-table grants (grant scope = control).
  await client.query(`GRANT USAGE ON SCHEMA ${s} TO web_app_user;`);
  await client.query(`GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA ${s} TO web_app_user;`);
  await client.query(`GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA ${s} TO web_app_user;`);
  for (const t of grantedTenantTables()) {
    await client.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON ${s}.${t} TO web_app_user;`);
    await client.query(`ALTER TABLE ${s}.${t} ENABLE ROW LEVEL SECURITY;`);
  }
  // Policies (idempotent: drop-if-exists then create).
  for (const p of tenantPolicies(s)) {
    await client.query(`DROP POLICY IF EXISTS ${p.name} ON ${s}.${p.table};`);
    const clauses = [`CREATE POLICY ${p.name} ON ${s}.${p.table} FOR ${p.cmd}`];
    if (p.using) clauses.push(`USING (${p.using})`);
    if (p.check) clauses.push(`WITH CHECK (${p.check})`);
    await client.query(clauses.join(' ') + ';');
  }
  await client.query(ORGS_PUBLIC_VIEW(s));
}

async function applySharedReadOnly(client) {
  for (const [schema, tables] of Object.entries(READ_ONLY_SHARED)) {
    await client.query(`GRANT USAGE ON SCHEMA ${schema} TO web_app_user;`);
    for (const t of tables) {
      await client.query(`GRANT SELECT ON ${schema}.${t} TO web_app_user;`);
      await client.query(`ALTER TABLE ${schema}.${t} ENABLE ROW LEVEL SECURITY;`);
      await client.query(`DROP POLICY IF EXISTS ${t}_read ON ${schema}.${t};`);
      await client.query(`CREATE POLICY ${t}_read ON ${schema}.${t} FOR SELECT USING (true);`);
    }
  }
}

/** Apply the whole migration on an already-open OWNER client. Used by main()
 *  (committed) and by the dry-run validator (inside BEGIN/ROLLBACK). `schemas`
 *  selects which env schemas to target (rollout: public first, then preview /
 *  master once their schemas are caught up — preview currently lags public, e.g.
 *  a missing supplier_org_id, so applying there fails until the additive delta
 *  lands). */
async function apply(client, pw, schemas = ['public']) {
  // Role (cluster-level — create once, then (re)set password).
  await client.query(`DO $$ BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'web_app_user') THEN
      CREATE ROLE web_app_user LOGIN;
    END IF;
  END $$;`);
  await client.query(`ALTER ROLE web_app_user WITH LOGIN PASSWORD ${quoteLiteral(pw)};`);
  console.log('[RLS] role web_app_user ensured');

  await client.query(PUBLIC_FUNCS);
  console.log('[RLS] public GUC helpers ensured');

  // Audit triggers (audit.stamp_audit_cols / forbid_hard_delete) fire on EVERY
  // insert/update/delete and are SECURITY INVOKER — they run as the caller, so
  // web_app_user needs USAGE on the audit schema + EXECUTE on its functions or
  // every write dies with "permission denied for schema audit" (caught by the
  // persona test). Global (audit is shared across env schemas).
  await client.query('GRANT USAGE ON SCHEMA audit TO web_app_user;');
  await client.query('GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA audit TO web_app_user;');
  console.log('[RLS] audit schema execute grants ensured');

  const present = (await client.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = ANY($1)`, [ENV_SCHEMAS]
  )).rows.map((r) => r.schema_name);

  for (const s of schemas) {
    if (!ENV_SCHEMAS.includes(s)) { console.log(`[RLS] '${s}' is not an env schema — skipped`); continue; }
    if (!present.includes(s)) { console.log(`[RLS] schema ${s} absent — skipped`); continue; }
    await applySchema(client, s);
    console.log(`[RLS] schema ${s}: helpers + grants + policies + orgs_public applied`);
  }
  await applySharedReadOnly(client);
  console.log('[RLS] shared/marketing read-only grants + policies applied');
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL || process.env.DIRECT_URL || process.env.DATABASE_URL;
  if (!url) { console.error('No owner DB URL (MIGRATION_DATABASE_URL/DIRECT_URL/DATABASE_URL).'); process.exit(1); }
  const pw = process.env.WEB_APP_PW;
  if (!pw) { console.error('WEB_APP_PW is required (the web_app_user password).'); process.exit(1); }
  const dryRun = process.argv.includes('--dry-run');
  // --schemas=public,preview (default: public only — the rollout applies dev first).
  const schemasArg = (process.argv.find((a) => a.startsWith('--schemas=')) || '').split('=')[1];
  const schemas = schemasArg ? schemasArg.split(',').map((s) => s.trim()).filter(Boolean) : ['public'];
  console.log(`[RLS] target schemas: ${schemas.join(', ')}${dryRun ? ' (DRY RUN)' : ''}`);

  const pool = new Pool({ connectionString: url });
  const client = await pool.connect();
  try {
    if (dryRun) await client.query('BEGIN');
    await apply(client, pw, schemas);
    if (dryRun) {
      await client.query('ROLLBACK');
      console.log('\n[RLS] DRY RUN OK — everything compiled against the live schema; rolled back, no changes persisted.');
    } else {
      console.log('\n[RLS] DONE. web_app_user is created and policied but NOT yet the app role.');
      console.log('[RLS] Next: run the persona tests as web_app_user, then flip DATABASE_URL.');
    }
  } catch (e) {
    if (dryRun) { try { await client.query('ROLLBACK'); } catch { /* ignore */ } }
    throw e;
  } finally {
    client.release();
    await pool.end();
  }
}

if (require.main === module) main().catch((e) => { console.error('[RLS] FAILED:', e.message); process.exit(1); });

module.exports = { apply, grantedTenantTables, tenantPolicies, ENV_SCHEMAS, READ_ONLY_SHARED };
