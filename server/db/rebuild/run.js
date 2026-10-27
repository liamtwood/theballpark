#!/usr/bin/env node
// Rebuild migration RUNNER — the single forward path for every v2dev-model env
// (dev / preview / prod). Applies the ordered rebuild migrations
// server/db/rebuild/0001..00NN in numeric order against ONE target DB, tracked
// in a per-DB `schema_migrations` ledger so re-runs are idempotent and only the
// pending gap is applied. This replaces the deprecated v2 forward-build
// (migrate-schemas.js) and the additive-delta-SQL promote step — see
// docs/plans/v2dev-env-topology-runbook.md.
//
// The migrations are SELF-SEEDING for system/reference data (0002 sentinels,
// 0007 codelists, 0008/0009 categories) and create web_app_user + grants, so a
// fresh DB pointed at this runner self-provisions: schema + sentinels + system
// reference in one pass. Tenant/demo data is never seeded here, never copied.
//
// CONNECTION: as the OWNER (superuser/postgres) via MIGRATION_DATABASE_URL —
// migrations create tables + RLS policies + roles and must bypass RLS. NEVER the
// app's web_app_user URL (that would fail on DDL/role creation). This is a
// deliberately separate env var from the app's DATABASE_URL.
//
// IMMUTABILITY: migrations are forward-only. Once a file is recorded in the
// ledger its checksum is frozen — editing an applied file is a hard error here
// (add a NEW numbered file instead). A fresh env with an empty ledger applies
// everything; an env mid-stream applies only what it hasn't.
//
// USAGE:
//   MIGRATION_DATABASE_URL=postgres://postgres:...@db.<ref>.supabase.co:5432/postgres \
//     node server/db/rebuild/run.js            # apply the pending gap
//   node server/db/rebuild/run.js --dry-run    # list pending, apply nothing
//   node server/db/rebuild/run.js --status     # print the ledger + pending, exit
//   node server/db/rebuild/run.js --env-file=.env.preview   # load that env (per-env config)
//
// Safe to re-run: already-applied files are skipped.

'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { Client } = require('pg');

const argv = process.argv.slice(2);
const DRY_RUN = argv.includes('--dry-run');
const STATUS_ONLY = argv.includes('--status');

// --env-file=<path> picks which env file to load (default: the worktree .env =
// dev). Keep a file PER ENV (.env, .env.preview, .env.prod) so every run NAMES
// its target — the explicit choice is the guard against migrating the wrong DB.
const envFileArg = argv.find((a) => a.startsWith('--env-file='));
const ENV_FILE = envFileArg
  ? path.resolve(process.cwd(), envFileArg.slice('--env-file='.length))
  : path.resolve(__dirname, '../../../.env');

// Load the chosen env file for convenience, but MIGRATION_DATABASE_URL must be
// set (we never fall back to the app DATABASE_URL — wrong role, and it would
// mask a misconfig by running DDL against the owner-less app connection).
try {
  require('dotenv').config({ path: ENV_FILE });
} catch {
  // dotenv is optional here — the env var may be supplied by the shell/CI.
}
if (!STATUS_ONLY) {
  try { console.log(`[run] env file: ${path.relative(process.cwd(), ENV_FILE)}`); } catch { /* best-effort */ }
}

const DIR = __dirname;
const MIGRATION_RE = /^\d{4}_.*\.sql$/; // 0001_foo.sql .. 00NN_bar.sql (gaps fine)

function listMigrationFiles() {
  return fs
    .readdirSync(DIR)
    .filter((f) => MIGRATION_RE.test(f)) // ignores run.js, tests/, README, etc.
    .sort(); // zero-padded 4-digit prefixes → lexical sort IS numeric order
}

function sha256(contents) {
  return crypto.createHash('sha256').update(contents, 'utf8').digest('hex');
}

function redactHost(url) {
  // Log WHICH database we're about to mutate, without leaking the password.
  try {
    const u = new URL(url);
    return `${u.host}${u.pathname}`;
  } catch {
    return '(unparseable MIGRATION_DATABASE_URL)';
  }
}

async function ensureLedger(client) {
  await client.query(`
    create table if not exists public.schema_migrations (
      filename   text primary key,
      sha256     text not null,
      applied_at timestamptz not null default now()
    )
  `);
}

async function loadLedger(client) {
  const { rows } = await client.query(
    'select filename, sha256 from public.schema_migrations'
  );
  return new Map(rows.map((r) => [r.filename, r.sha256]));
}

async function applyFile(client, file, hash) {
  const sql = fs.readFileSync(path.join(DIR, file), 'utf8');
  await client.query('BEGIN');
  try {
    await client.query(sql);
    await client.query(
      'insert into public.schema_migrations (filename, sha256) values ($1, $2)',
      [file, hash]
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  }
}

async function main() {
  const url = process.env.MIGRATION_DATABASE_URL;
  if (!url) {
    console.error(
      '[run] MIGRATION_DATABASE_URL is not set. Point it at the target env\'s OWNER\n' +
        '      (postgres) connection — never the app web_app_user URL. Aborting.'
    );
    process.exit(1);
  }

  const files = listMigrationFiles();
  if (files.length === 0) {
    console.error(`[run] No migration files found in ${DIR}. Aborting.`);
    process.exit(1);
  }

  const client = new Client({ connectionString: url });
  await client.connect();
  console.log(`[run] target: ${redactHost(url)}  (${files.length} migration files on disk)`);

  try {
    await ensureLedger(client);
    const applied = await loadLedger(client);

    const pending = [];
    for (const file of files) {
      const hash = sha256(fs.readFileSync(path.join(DIR, file), 'utf8'));
      const recorded = applied.get(file);
      if (recorded === undefined) {
        pending.push({ file, hash });
      } else if (recorded !== hash) {
        // Forward-only immutability: an applied file changed on disk.
        throw new Error(
          `[run] CHECKSUM MISMATCH for already-applied "${file}".\n` +
            `      Migrations are immutable once applied — do NOT edit a run file;\n` +
            `      add a new numbered migration instead. ledger=${recorded.slice(0, 12)} disk=${hash.slice(0, 12)}`
        );
      }
    }

    if (STATUS_ONLY) {
      console.log(`[run] applied: ${applied.size} | pending: ${pending.length}`);
      pending.forEach((p) => console.log(`      pending → ${p.file}`));
      return;
    }

    if (pending.length === 0) {
      console.log('[run] up to date — nothing to apply.');
      return;
    }

    console.log(`[run] ${pending.length} pending migration(s):`);
    pending.forEach((p) => console.log(`      → ${p.file}`));

    if (DRY_RUN) {
      console.log('[run] --dry-run: applied nothing.');
      return;
    }

    for (const { file, hash } of pending) {
      process.stdout.write(`[run] applying ${file} ... `);
      await applyFile(client, file, hash);
      console.log('ok');
    }
    console.log(`[run] done — applied ${pending.length} migration(s).`);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
