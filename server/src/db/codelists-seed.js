// pV2-CODELISTS-01 — the RC/RCV v2 transform + the locked 12-list seed
// (docs/CODELISTS.md). Required + run by migrate-schemas.js (section 4f);
// split into its own module so the seed inventory is reviewable without
// scrolling a 1,600-line migration.
//
// The three-layer no-DELETE / integrity posture (chat, 2026-06-12):
//   1. API: DELETE → 405 (routes/codelists-v2.js)
//   2. DB: forbid-hard-delete trigger via the audit helper (here)
//   3. Seed-time assertion: every parent default_code ↔ exactly one
//      is_default value — fails the MIGRATION loudly, not prod silently.

/** ISO 3166-1 alpha-2 — labels resolved via Intl at seed time so we never
 *  hand-type 249 country names. */
const ISO_3166_1_ALPHA_2 = (
  'AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ ' +
  'BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ ' +
  'CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ ' +
  'DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR ' +
  'GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY ' +
  'HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT ' +
  'JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ ' +
  'LA LB LC LI LK LR LS LT LU LV LY ' +
  'MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ ' +
  'NA NC NE NF NG NI NL NO NP NR NU NZ OM ' +
  'PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW ' +
  'SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ ' +
  'TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ ' +
  'UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'
).split(/\s+/);

/** The locked 12 parents. default_code must have exactly one is_default
 *  value (asserted below). */
const PARENTS = [
  { list: 'item_unit',            type: 'ballpark', app: 'catalogue', def: 'each',    desc: 'Controls the unit options on catalogue items',              ct: 'items',              cc: 'unit' },
  { list: 'item_time_unit',       type: 'ballpark', app: 'catalogue', def: 'day',     desc: 'Controls the time-unit options on time-billable items',     ct: 'items',              cc: 'time_unit' },
  { list: 'currency',             type: 'ballpark', app: 'core',      def: 'GBP',     desc: 'Controls the currency options platform-wide',               ct: 'projects',           cc: 'currency' },
  { list: 'budget_tier',          type: 'ballpark', app: 'project',   def: 'unknown', desc: 'Controls the budget-tier options on projects',              ct: 'projects',           cc: 'tier' },
  // pV2-PROJECTS-02: event_type LOV (ballpark — admins curate it). Seed
  // includes the 3 values already in projects data (activation/gala/pop-up)
  // so existing rows resolve to a codelist value.
  { list: 'event_type',           type: 'ballpark', app: 'project',   def: 'conference', desc: 'Controls the event-type options on projects',            ct: 'projects',           cc: 'event_type' },
  // projects still ride the legacy shared.statuses FK (status_id) — the
  // consumer pointer lands with the projects-arc consolidation.
  { list: 'project_status',       type: 'system',   app: 'project',   def: 'draft',   desc: 'Controls what status is supported by a project',            ct: null,                 cc: null },
  { list: 'category_status',      type: 'system',   app: 'project',   def: 'draft',   desc: 'Controls what status is supported by a project category',   ct: null,                 cc: null },
  // the v2 inbox arc creates messages.status — pointer lands with it.
  { list: 'message_status',       type: 'system',   app: 'messaging', def: 'draft',   desc: 'Controls what status is supported by an Inbox message',     ct: null,                 cc: null },
  { list: 'page_title_mode',      type: 'system',   app: 'core',      def: 'greeting', desc: 'Controls the home-hero title modes in page settings',      ct: null,                 cc: null },
  { list: 'hero_align',           type: 'system',   app: 'core',      def: 'center',  desc: 'Controls the hero alignment options in page settings',      ct: null,                 cc: null },
  { list: 'membership_status',    type: 'system',   app: 'org',       def: 'active',  desc: 'Controls what status is supported by an org membership',    ct: 'user_orgs',          cc: 'status' },
  { list: 'item_approval_status', type: 'system',   app: 'catalogue', def: 'pending', desc: 'Controls the marketplace approval pipeline for items',      ct: 'items',              cc: 'approval_status' },
  { list: 'country',              type: 'system',   app: 'core',      def: 'GB',      desc: 'ISO 3166-1 alpha-2 country list (fixed, not extensible)',   ct: 'orgs',               cc: 'country' },
];

/** Net-new value seeds. meta colors use TOKEN refs per the locked rich-meta
 *  convention (v1-inherited status lists keep their hex .color until
 *  CODELISTS-02 migrates their consumers — flagged deviation). */
const NEW_VALUES = {
  // The worked example — docs/CODELISTS.md verbatim.
  message_status: [
    { code: 'draft',   label: 'Draft',   sort: 1, def: true,  meta: { color: '--color-text-muted', color_soft: '--color-fill',         icon: 'pencil-line', is_terminal: false, allowed_next_codes: ['sent', 'deleted'] } },
    { code: 'sent',    label: 'Sent',    sort: 2, def: false, meta: { color: '--color-info',       color_soft: '--color-info-soft',    icon: 'send',        is_terminal: false, allowed_next_codes: ['read', 'deleted'] } },
    { code: 'read',    label: 'Read',    sort: 3, def: false, meta: { color: '--color-success',    color_soft: '--color-success-soft', icon: 'check-check', is_terminal: false, allowed_next_codes: ['deleted'] } },
    { code: 'deleted', label: 'Deleted', sort: 4, def: false, meta: { color: '--color-danger',     color_soft: '--color-danger-soft',  icon: 'trash-2',     is_terminal: true,  allowed_next_codes: [] } },
  ],
  page_title_mode: [
    { code: 'greeting', label: 'Greeting',   sort: 1, def: true },
    { code: 'username', label: 'Username',   sort: 2, def: false },
    { code: 'orgName',  label: 'Org name',   sort: 3, def: false },
    { code: 'fixed',    label: 'Fixed text', sort: 4, def: false },
  ],
  hero_align: [
    { code: 'center', label: 'Center', sort: 1, def: true },
    { code: 'left',   label: 'Left',   sort: 2, def: false },
  ],
  // MUST match user_orgs_status_check exactly.
  membership_status: [
    { code: 'active',    label: 'Active',    sort: 1, def: true,  meta: { color: '--color-success', color_soft: '--color-success-soft', icon: 'check',      is_terminal: false, allowed_next_codes: ['suspended'] } },
    { code: 'invited',   label: 'Invited',   sort: 2, def: false, meta: { color: '--color-warn',    color_soft: '--color-warn-soft',    icon: 'mail',       is_terminal: false, allowed_next_codes: ['active'] } },
    { code: 'suspended', label: 'Suspended', sort: 3, def: false, meta: { color: '--color-danger',  color_soft: '--color-danger-soft',  icon: 'circle-off', is_terminal: false, allowed_next_codes: ['active'] } },
  ],
  // Decorative LOV (not a status) — no rich meta. Codes 'activation' /
  // 'gala' / 'pop-up' match existing projects.event_type data.
  event_type: [
    { code: 'conference', label: 'Conference',     sort: 1, def: true },
    { code: 'launch',     label: 'Product launch', sort: 2, def: false },
    { code: 'activation', label: 'Brand activation', sort: 3, def: false },
    { code: 'exhibition', label: 'Exhibition',     sort: 4, def: false },
    { code: 'gala',       label: 'Gala',           sort: 5, def: false },
    { code: 'awards',     label: 'Awards',         sort: 6, def: false },
    { code: 'party',      label: 'Party',          sort: 7, def: false },
    { code: 'pop-up',     label: 'Pop-up',         sort: 8, def: false },
    { code: 'dinner',     label: 'Dinner',         sort: 9, def: false },
    { code: 'other',      label: 'Other',          sort: 10, def: false },
  ],
  item_approval_status: [
    // pV2-STORE-01 — supplier's pre-submit state. draft → (submit) → pending.
    { code: 'draft',    label: 'Draft',    sort: 0, def: false, meta: { color: '--color-text-muted', color_soft: '--color-fill', icon: 'pencil-line', is_terminal: false, allowed_next_codes: ['pending'] } },
    { code: 'pending',  label: 'Pending',  sort: 1, def: true,  meta: { color: '--color-warn',    color_soft: '--color-warn-soft',    icon: 'clock',  is_terminal: false, allowed_next_codes: ['approved', 'rejected'] } },
    { code: 'approved', label: 'Approved', sort: 2, def: false, meta: { color: '--color-success', color_soft: '--color-success-soft', icon: 'check',  is_terminal: false, allowed_next_codes: ['rejected'] } },
    // pV2-STORE-01: the admin moderation route writes 'rejected' now, so it must
    // be ACTIVE or its status pill can't resolve (GET /values is active-only).
    // Existing inactive rows are flipped by the UPDATE in seedCodelists().
    { code: 'rejected', label: 'Rejected', sort: 3, def: false, meta: { color: '--color-danger', color_soft: '--color-danger-soft', icon: 'x', is_terminal: true, allowed_next_codes: [] } },
  ],
};

async function seedCodelists(client) {
  // ── RCV extensions (idempotent) ─────────────────────────────────────
  await client.query(`
    ALTER TABLE shared.reference_codelist_values
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
  `);
  // One default per list, enforced structurally (layer 2.5).
  await client.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS reference_codelist_values_one_default
      ON shared.reference_codelist_values (list_name) WHERE is_default;
  `);

  // ── RC parent ───────────────────────────────────────────────────────
  await client.query(`
    CREATE TABLE IF NOT EXISTS shared.reference_codelists (
      list_name        VARCHAR(100) PRIMARY KEY,
      description      TEXT,
      is_active        BOOLEAN DEFAULT true,
      default_code     VARCHAR(50),
      type             VARCHAR(20) NOT NULL DEFAULT 'system'
                       CHECK (type IN ('system', 'ballpark')),
      application      VARCHAR(50) NOT NULL DEFAULT 'core',
      consumer_table   VARCHAR(100),
      consumer_column  VARCHAR(100),
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_by       UUID
    );
  `);

  // ── Net-new values ──────────────────────────────────────────────────
  for (const [list, values] of Object.entries(NEW_VALUES)) {
    for (const v of values) {
      await client.query(
        `INSERT INTO shared.reference_codelist_values
           (list_name, code, label, sort_order, is_active, is_system, is_default, meta)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7::jsonb)
         ON CONFLICT (list_name, code) DO NOTHING`,
        [list, v.code, v.label, v.sort, v.active !== false, v.def, JSON.stringify(v.meta ?? {})]
      );
    }
  }

  // pV2-STORE-01 — the v1-seeded `item_approval_status.rejected` was INACTIVE
  // (no writer at seed time); the admin moderation route writes it now, so its
  // pill must resolve. ON CONFLICT DO NOTHING never updates an existing row, so
  // flip it explicitly (idempotent).
  await client.query(
    `UPDATE shared.reference_codelist_values SET is_active = true
       WHERE list_name = 'item_approval_status' AND code = 'rejected' AND is_active = false`
  );

  // country — codes constant, labels via Intl (never hand-typed).
  const regionNames = new Intl.DisplayNames(['en'], { type: 'region' });
  for (let i = 0; i < ISO_3166_1_ALPHA_2.length; i++) {
    const code = ISO_3166_1_ALPHA_2[i];
    await client.query(
      `INSERT INTO shared.reference_codelist_values
         (list_name, code, label, sort_order, is_active, is_system, is_default)
       VALUES ('country', $1, $2, $3, true, true, $4)
       ON CONFLICT (list_name, code) DO NOTHING`,
      [code, regionNames.of(code) ?? code, i + 1, code === 'GB']
    );
  }

  // is_default flags for the v1-inherited lists (values already exist).
  for (const p of PARENTS) {
    await client.query(
      `UPDATE shared.reference_codelist_values
          SET is_default = true
        WHERE list_name = $1 AND code = $2
          AND NOT EXISTS (SELECT 1 FROM shared.reference_codelist_values
                           WHERE list_name = $1 AND is_default)`,
      [p.list, p.def]
    );
  }

  // ── Parents (after values — default_code must be satisfiable) ───────
  for (const p of PARENTS) {
    await client.query(
      `INSERT INTO shared.reference_codelists
         (list_name, description, is_active, default_code, type, application,
          consumer_table, consumer_column)
       VALUES ($1, $2, true, $3, $4, $5, $6, $7)
       ON CONFLICT (list_name) DO NOTHING`,
      [p.list, p.desc, p.def, p.type, p.app, p.ct, p.cc]
    );
  }
  // Backfill a parent for any v1-era list not in the inventory.
  await client.query(`
    INSERT INTO shared.reference_codelists (list_name, description, type, application)
    SELECT DISTINCT v.list_name, 'v1-inherited — undocumented', 'system', 'core'
      FROM shared.reference_codelist_values v
      LEFT JOIN shared.reference_codelists c ON c.list_name = v.list_name
     WHERE c.list_name IS NULL;
  `);

  // ── v2.19a (RP-09): v1-era hex meta colors → token refs ─────────────
  // Each app's styles.css owns the hue (--color-state-* set seeded with
  // the ORIGINAL v1 hex in both apps — zero visual change). Idempotent:
  // rows already on token refs don't match the hex keys.
  // Acceptance (AUDIT_LEDGER RP-09): meta->>'color' LIKE '#%' → 0 rows.
  const HEX_TO_TOKEN = {
    '#F59E0B': '--color-state-amber',
    '#10B981': '--color-state-emerald',
    '#22C55E': '--color-state-green',
    '#6B7280': '--color-state-gray',
    '#9CA3AF': '--color-state-gray-light',
    '#3B82F6': '--color-state-blue',
    '#F97316': '--color-state-orange',
    '#6366F1': '--color-state-indigo',
    '#0EA5E9': '--color-state-sky',
    '#8B5CF6': '--color-state-violet',
  };
  for (const [hex, token] of Object.entries(HEX_TO_TOKEN)) {
    await client.query(
      `UPDATE shared.reference_codelist_values
          SET meta = jsonb_set(meta, '{color}', to_jsonb($2::text)), updated_at = NOW()
        WHERE upper(meta->>'color') = $1`,
      [hex, token]
    );
  }
  // upper() mirrors the sweep's matching (audit 02-F-1) — any case of
  // surviving hex is caught, not just the seed contract's uppercase.
  const hexLeft = await client.query(
    `SELECT COUNT(*) AS n FROM shared.reference_codelist_values WHERE upper(meta->>'color') LIKE '#%'`
  );
  if (Number(hexLeft.rows[0].n) > 0) {
    console.warn(`  WARNING: ${hexLeft.rows[0].n} codelist meta color(s) still hex — extend HEX_TO_TOKEN (RP-09).`);
  }

  // ── v2.19a: currency now has a consumer (orgs.default_currency) ─────
  await client.query(`
    UPDATE shared.reference_codelists
       SET consumer_table = 'orgs', consumer_column = 'default_currency', updated_at = NOW()
     WHERE list_name = 'currency'
       AND (consumer_table IS DISTINCT FROM 'orgs' OR consumer_column IS DISTINCT FROM 'default_currency');
  `);

  // ── Layer 3: seed-time invariant assertion (fail LOUDLY) ────────────
  const drift = await client.query(`
    SELECT c.list_name, c.default_code,
           COUNT(v.id) FILTER (WHERE v.is_default) AS defaults,
           COUNT(v.id) FILTER (WHERE v.is_default AND v.code = c.default_code) AS matching
      FROM shared.reference_codelists c
      LEFT JOIN shared.reference_codelist_values v ON v.list_name = c.list_name
     WHERE c.default_code IS NOT NULL
     GROUP BY c.list_name, c.default_code
    HAVING COUNT(v.id) FILTER (WHERE v.is_default) <> 1
        OR COUNT(v.id) FILTER (WHERE v.is_default AND v.code = c.default_code) <> 1
  `);
  if (drift.rows.length) {
    throw new Error(
      'codelist default drift: ' +
        drift.rows.map((r) => `${r.list_name} (default_code=${r.default_code}, is_default rows=${r.defaults}, matching=${r.matching})`).join('; ')
    );
  }

  // ── Layer 2: forbid hard delete (audit helper, when installed) ──────
  await client.query(`
    DO $audit$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'audit' AND p.proname = 'add_audit_columns'
      ) THEN
        PERFORM audit.add_audit_columns('shared', 'reference_codelists');
        PERFORM audit.add_audit_columns('shared', 'reference_codelist_values');
      END IF;
    END $audit$;
  `);

  return PARENTS.length;
}

module.exports = { seedCodelists, PARENTS, ISO_3166_1_ALPHA_2 };
