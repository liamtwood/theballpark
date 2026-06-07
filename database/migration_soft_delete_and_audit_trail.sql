-- =============================================================================
-- Ballpark — Soft-Delete + Audit-Trail Foundation  (Item 1, pre-launch)
-- Author it, DO NOT run automatically. Liam runs in the Supabase SQL editor,
-- ONCE PER ENVIRONMENT SCHEMA: public (dev) → preview → master.
--
-- Read database/SWEEP_soft_delete_audit.md (the Sweep Completeness enumeration)
-- and the DESIGN DECISIONS block below BEFORE running. Several classifications
-- (junction-table exemptions, is_active→deleted_at convergence) are deliberate
-- and need sign-off.
--
-- ─────────────────────────────────────────────────────────────────────────────
-- DESIGN DECISIONS (deviations from the brief's spec — with rationale)
-- ─────────────────────────────────────────────────────────────────────────────
-- D1. audit_log.record_id is TEXT, not UUID. Not every audited table has a
--     single uuid PK (welcome_content = text PK, welcome_settings = int PK,
--     project_item_suppliers = composite PK). record_id stores to_jsonb(row)->>'id'
--     (the uuid/int/text id) and is NULL for composite-PK tables — the full row
--     still lives in `diff`, so nothing is lost.
-- D2. audit_log gains a table_schema column. dev/preview/master are three
--     schemas in ONE database; one shared audit.audit_log keyed by
--     (table_schema, table_name) keeps each environment's history isolated and
--     queryable without three copies of the infrastructure.
-- D3. current_user_id() is NOT bare auth.uid(). The backend connects with a
--     pooled SERVICE-ROLE connection, so auth.uid() is NULL for app writes.
--     Resolution order: (1) a server-set per-request GUC `app.current_user_id`
--     (the backend resolves the authenticated user and `SET LOCAL`s it — server
--     controlled, never raw client input), (2) auth.uid() for when real per-user
--     JWT connections land, (3) a SYSTEM sentinel uuid so unattributed writes
--     (migrations, jobs) NEVER block. This keeps changed_by NOT NULL without the
--     trigger ever failing a legitimate write.
--     >>> APP FOLLOW-UP: backend must `SET LOCAL app.current_user_id` per request
--         (see middleware/auth) or all app writes attribute to SYSTEM. <<<
-- D4. No GLOBAL `REVOKE DELETE`. Junction / sync tables (supplier_item_tag,
--     project_item_suppliers, project_items) are maintained by DELETE-and-REINSERT
--     (taxonomy re-sync on every item save; cart toggles). A blanket revoke/raise
--     would break those. Instead: default-deny via a BEFORE DELETE raise on every
--     ENTITY table, and the junction/sync tables are EXEMPT (keep hard delete).
--     This is a correct allow-list: default is "no hard delete", the few churn
--     tables are the explicit exceptions.
-- D5. Convergence: messages + marketing.guestlist_signup already soft-delete via
--     `deleted_at`. Everything else currently soft-deletes via `is_active=false`.
--     This migration ADDS `deleted_at` everywhere and makes it the standard; the
--     app-layer follow-up converts the is_active services to stamp deleted_at.
--     This migration does NOT touch is_active (no data change), so it is safe to
--     run before the app conversion — EXCEPT for the hard-delete block (D6).
-- D6. SEQUENCING: the BEFORE DELETE raise will break EXISTING hard-delete call
--     sites on entity tables until the app converts them to softDelete. Known
--     sites (see SWEEP doc §Blast radius): estimate_items, shared.codelists,
--     shared.feedback(+categories), messages.hardDelete. CONVERT THESE FIRST, or
--     run this migration's PART C (the triggers) only after the app is converted.
--     PARTS A+B (infrastructure + deleted_at columns) are safe to run anytime.
-- =============================================================================


-- ─────────────────────────────────────────────────────────────────────────────
-- PART A — AUDIT INFRASTRUCTURE (run once; schema-agnostic, shared)
-- ─────────────────────────────────────────────────────────────────────────────
create schema if not exists audit;

create table if not exists audit.audit_log (
  id            bigserial primary key,
  table_schema  text        not null,                 -- D2: which env schema
  table_name    text        not null,
  record_id     text,                                 -- D1: text, null for composite PKs
  action        text        not null
                  check (action in ('create','update','soft_delete','restore')),
  changed_by    uuid        not null,                 -- D3: GUC → auth.uid() → SYSTEM
  changed_at    timestamptz not null default now(),
  org_id        uuid,                                 -- denormalized for per-org queries
  diff          jsonb,                                -- {col:{old,new}} on update; full row on create
  reason        text
);
create index if not exists audit_log_record_idx  on audit.audit_log (table_schema, table_name, record_id);
create index if not exists audit_log_actor_idx   on audit.audit_log (changed_by, changed_at desc);
create index if not exists audit_log_org_idx      on audit.audit_log (org_id, changed_at desc);

-- D3 — acting user, never raw client input; never NULL.
create or replace function audit.current_user_id() returns uuid
language plpgsql stable as $$
declare v uuid;
begin
  begin v := nullif(current_setting('app.current_user_id', true), '')::uuid; exception when others then v := null; end;
  if v is not null then return v; end if;
  begin v := auth.uid(); exception when others then v := null; end;
  if v is not null then return v; end if;
  return '00000000-0000-0000-0000-000000000000'::uuid;   -- SYSTEM sentinel
end $$;

-- Generic row auditor — fully column-agnostic via to_jsonb(), so one function
-- serves every table regardless of its columns.
create or replace function audit.audit_row() returns trigger
language plpgsql as $$
declare
  v_old jsonb; v_new jsonb; v_diff jsonb;
  v_action text; v_record_id text; v_org_id uuid;
begin
  if (tg_op = 'INSERT') then
    v_new := to_jsonb(NEW); v_action := 'create'; v_diff := v_new;
  elsif (tg_op = 'UPDATE') then
    v_new := to_jsonb(NEW); v_old := to_jsonb(OLD);
    if  (v_old->>'deleted_at') is null     and (v_new->>'deleted_at') is not null then v_action := 'soft_delete';
    elsif (v_old->>'deleted_at') is not null and (v_new->>'deleted_at') is null     then v_action := 'restore';
    else v_action := 'update';
    end if;
    select jsonb_object_agg(key, jsonb_build_object('old', v_old->key, 'new', v_new->key))
      into v_diff
      from (select distinct key from (
              select jsonb_object_keys(v_new) as key
              union select jsonb_object_keys(v_old) as key) k) keys
     where (v_old->key) is distinct from (v_new->key);
    if v_diff is null then return null; end if;   -- no real change → no audit row
  end if;

  v_record_id := coalesce(v_new->>'id', v_old->>'id');
  begin v_org_id := coalesce(v_new->>'org_id', v_old->>'org_id')::uuid; exception when others then v_org_id := null; end;

  insert into audit.audit_log (table_schema, table_name, record_id, action, changed_by, org_id, diff)
  values (tg_table_schema, tg_table_name, v_record_id, v_action, audit.current_user_id(), v_org_id, coalesce(v_diff, '{}'::jsonb));
  return null;  -- AFTER trigger
end $$;

-- D4/D6 — hard-delete guard (entity tables only).
create or replace function audit.forbid_hard_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Hard delete forbidden on %.% — set deleted_at (softDelete) instead', tg_table_schema, tg_table_name
    using errcode = 'check_violation';
end $$;

-- Reusable applier: deleted_at column + audit trigger (+ optional delete guard).
create or replace function audit.add_audit_to_table(p_schema text, p_table text, p_forbid_delete boolean default true)
returns void language plpgsql as $$
begin
  execute format('alter table %I.%I add column if not exists deleted_at timestamptz', p_schema, p_table);
  execute format('drop trigger if exists trg_audit_row on %I.%I', p_schema, p_table);
  execute format('create trigger trg_audit_row after insert or update on %I.%I for each row execute function audit.audit_row()', p_schema, p_table);
  execute format('drop trigger if exists trg_forbid_hard_delete on %I.%I', p_schema, p_table);
  if p_forbid_delete then
    execute format('create trigger trg_forbid_hard_delete before delete on %I.%I for each row execute function audit.forbid_hard_delete()', p_schema, p_table);
  end if;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- PART B + C — APPLY to one environment schema.
-- Set v_schema and run. Then change it and run again: public → preview → master.
-- PART B = deleted_at + audit triggers (safe anytime). PART C = the delete guard
-- (set p_forbid_delete=true rows) — only AFTER the app's hard-delete sites on
-- those tables are converted (see D6). To stage: run with v_guard=false first,
-- convert the app, then re-run with v_guard=true.
-- ─────────────────────────────────────────────────────────────────────────────
do $$
declare
  v_schema text := 'public';   -- <<< CHANGE PER ENV: public (dev) | preview | master
  v_guard  boolean := true;    -- <<< false on first pass if app not yet converted (D6)
  t text;
begin
  -- ENTITY tables — deleted_at + audit + hard-delete guard
  foreach t in array array[
    'orgs','users','clients','categories','items','projects','project_categories',
    'estimates','estimate_items','messages','message_items','message_item_events',
    'message_item_decisions','quote_requests','tag','ai_search_hints','statuses'
  ] loop
    perform audit.add_audit_to_table(v_schema, t, v_guard);
  end loop;

  -- APPEND-ONLY ledger — guard ON (immutable), audit on insert. Never soft-deleted.
  perform audit.add_audit_to_table(v_schema, 'balls_transactions', v_guard);

  -- JUNCTION / SYNC tables (D4) — audit ON, hard-delete guard OFF (delete-reinsert).
  foreach t in array array[
    'project_items','project_item_suppliers','supplier_item_tag','favourites'
  ] loop
    perform audit.add_audit_to_table(v_schema, t, false);
  end loop;
end $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SHARED / MARKETING schemas (not per-env; run once each).
--   shared.feedback, shared.codelists, shared.feature_flags,
--   shared.feedback_categories   → entity/config: audit + guard (convert app first)
--   marketing.guestlist_signup   → already soft-deletes; add audit + guard
--   marketing.welcome_content/_settings → config (text/int PK): audit ON, guard ON,
--       but record_id will be the text/int key or NULL (D1)
-- EXEMPT (no change): internal.project_log (append-only commit log),
--   audit.audit_log (itself), shared.backlog / shared.bugs (internal dev tooling
--   — see SWEEP doc; revisit if they become product surfaces).
-- ─────────────────────────────────────────────────────────────────────────────
do $$
begin
  perform audit.add_audit_to_table('shared', 'feedback', true);
  perform audit.add_audit_to_table('shared', 'codelists', true);
  perform audit.add_audit_to_table('shared', 'feature_flags', true);
  perform audit.add_audit_to_table('shared', 'feedback_categories', true);
  perform audit.add_audit_to_table('marketing', 'guestlist_signup', true);
  perform audit.add_audit_to_table('marketing', 'welcome_content', true);
  perform audit.add_audit_to_table('marketing', 'welcome_settings', true);
end $$;

-- =============================================================================
-- End. Verify: select table_schema, table_name, count(*) from audit.audit_log
--               group by 1,2;  -- after some app activity.
-- Rollback a single table: drop trigger trg_audit_row / trg_forbid_hard_delete
--               on <schema>.<table>;  (deleted_at column can stay — harmless.)
-- =============================================================================
