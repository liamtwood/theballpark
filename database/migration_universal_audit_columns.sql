-- =============================================================================
-- Ballpark — Universal Audit Columns + Hard-Delete Guard  (Item 1, minimum foundation)
-- Author it, DO NOT run automatically. Liam runs in the Supabase SQL editor,
-- ONCE PER ENVIRONMENT SCHEMA: public (dev) → preview → master.
-- Read SWEEP_soft_delete_audit.md (the table classification) first.
--
-- SCOPE (this migration): the 6 universal audit columns on every business table,
-- a BEFORE trigger that stamps them automatically, and a BEFORE DELETE guard on
-- entity tables. NO audit_log table — the universal entity-scoped audit_log +
-- trigger ship in a SEPARATE commit later this week (Option A, entity-scoped).
--
-- Eyes-open trade-off: row-level HISTORY starts the day audit_log goes live. The
-- 6 columns capture WHO-TOUCHED-LAST for everything from day 1 (real attribution
-- once the SET LOCAL middleware lands; app-supplied / NULL until then — never
-- clobbers a real value, never blocks a write).
--
-- DESIGN NOTES (deviations forced by the real schema/runtime):
--  • current_user_id() resolves: server-set per-request GUC `app.current_user_id`
--    (the backend's SET LOCAL middleware — never raw client input) → Supabase
--    auth.uid() (when per-user JWT lands) → NULL. Columns are NULLABLE; NULL =
--    unattributed (no sentinel needed at the column layer).
--  • The stamp trigger PREFERS the resolved actor, else keeps any app-supplied
--    value — so it never regresses the attribution the app already passes.
--  • No global REVOKE DELETE. Junction / sync tables (supplier_item_tag,
--    project_item_suppliers, project_items) are maintained by delete-and-reinsert
--    (taxonomy re-sync on every item save; cart toggles) — they get the columns +
--    stamp but NOT the hard-delete guard.
--  • SEQUENCING: the guard breaks the 5 existing entity hard-delete call sites
--    (estimate_items, shared.codelists, shared.feedback(_categories), messages
--    .hardDelete, project_categories — see SWEEP doc). Convert those to softDelete
--    first, OR run with v_guard=false, convert, then re-run with v_guard=true.
--    The columns + stamp trigger are safe to run anytime.
-- =============================================================================

create schema if not exists audit;

-- Acting user — server GUC → Supabase JWT → NULL. Never raw client input.
create or replace function audit.current_user_id() returns uuid
language plpgsql stable as $$
declare v uuid;
begin
  begin v := nullif(current_setting('app.current_user_id', true), '')::uuid; exception when others then v := null; end;
  if v is not null then return v; end if;
  begin v := auth.uid(); exception when others then v := null; end;
  return v;
end $$;

-- Stamp the 6 columns. Prefers the resolved actor, falls back to app-supplied,
-- else NULL. created_* are immutable after insert; deleted_by tracks soft-delete
-- / restore via the deleted_at transition.
create or replace function audit.stamp_audit_cols() returns trigger
language plpgsql as $$
declare v_uid uuid := audit.current_user_id();
begin
  if tg_op = 'INSERT' then
    NEW.created_at := coalesce(NEW.created_at, now());
    NEW.created_by := coalesce(v_uid, NEW.created_by);
    NEW.updated_at := now();
    NEW.updated_by := coalesce(v_uid, NEW.updated_by);
  elsif tg_op = 'UPDATE' then
    NEW.created_at := OLD.created_at;            -- immutable
    NEW.created_by := OLD.created_by;            -- immutable
    NEW.updated_at := now();
    NEW.updated_by := coalesce(v_uid, NEW.updated_by);
    if    NEW.deleted_at is not null and OLD.deleted_at is null then
      NEW.deleted_by := coalesce(v_uid, NEW.deleted_by);     -- soft delete
    elsif NEW.deleted_at is null and OLD.deleted_at is not null then
      NEW.deleted_by := null;                                 -- restore
    end if;
  end if;
  return NEW;
end $$;

create or replace function audit.forbid_hard_delete() returns trigger
language plpgsql as $$
begin
  raise exception 'Hard delete forbidden on %.% — set deleted_at (softDelete) instead', tg_table_schema, tg_table_name
    using errcode = 'check_violation';
end $$;

-- Reusable applier: 6 columns + stamp trigger (+ optional hard-delete guard).
create or replace function audit.add_audit_columns(p_schema text, p_table text, p_forbid_delete boolean default true)
returns void language plpgsql as $$
begin
  execute format('alter table %I.%I add column if not exists created_at timestamptz default now()', p_schema, p_table);
  execute format('alter table %I.%I add column if not exists created_by uuid', p_schema, p_table);
  execute format('alter table %I.%I add column if not exists updated_at timestamptz default now()', p_schema, p_table);
  execute format('alter table %I.%I add column if not exists updated_by uuid', p_schema, p_table);
  execute format('alter table %I.%I add column if not exists deleted_at timestamptz', p_schema, p_table);
  execute format('alter table %I.%I add column if not exists deleted_by uuid', p_schema, p_table);
  execute format('drop trigger if exists trg_stamp_audit on %I.%I', p_schema, p_table);
  execute format('create trigger trg_stamp_audit before insert or update on %I.%I for each row execute function audit.stamp_audit_cols()', p_schema, p_table);
  execute format('drop trigger if exists trg_forbid_hard_delete on %I.%I', p_schema, p_table);
  if p_forbid_delete then
    execute format('create trigger trg_forbid_hard_delete before delete on %I.%I for each row execute function audit.forbid_hard_delete()', p_schema, p_table);
  end if;
end $$;


-- ── APPLY to one environment schema. Set v_schema, run; repeat public→preview→master.
-- v_guard=false on the first pass if the 5 hard-delete sites are not yet converted.
do $$
declare
  v_schema text := 'public';   -- <<< CHANGE PER ENV: public (dev) | preview | master
  v_guard  boolean := true;    -- <<< false until the 5 entity hard-delete sites are converted
  t text;
begin
  -- ENTITY tables — 6 columns + stamp + hard-delete guard
  foreach t in array array[
    'orgs','users','clients','categories','items','projects','project_categories',
    'estimates','estimate_items','messages','message_items','message_item_events',
    'message_item_decisions','quote_requests','tag','ai_search_hints','statuses',
    'balls_transactions'
  ] loop
    perform audit.add_audit_columns(v_schema, t, v_guard);
  end loop;

  -- JUNCTION / SYNC tables — 6 columns + stamp, NO guard (delete-and-reinsert)
  foreach t in array array['project_items','project_item_suppliers','supplier_item_tag','favourites'] loop
    perform audit.add_audit_columns(v_schema, t, false);
  end loop;
end $$;

-- ── SHARED / MARKETING (not per-env; run once each). Convert their hard-delete
-- sites (shared.codelists, shared.feedback(_categories)) before guard=true.
do $$
begin
  perform audit.add_audit_columns('shared','feedback', true);
  perform audit.add_audit_columns('shared','codelists', true);
  perform audit.add_audit_columns('shared','feature_flags', true);
  perform audit.add_audit_columns('shared','feedback_categories', true);
  perform audit.add_audit_columns('marketing','guestlist_signup', true);
  perform audit.add_audit_columns('marketing','welcome_content', true);
  perform audit.add_audit_columns('marketing','welcome_settings', true);
end $$;

-- =============================================================================
-- Verify:  select column_name from information_schema.columns
--          where table_schema='public' and table_name='items'
--          and column_name in ('created_by','updated_by','deleted_at','deleted_by');
-- Rollback one table: drop trigger trg_stamp_audit / trg_forbid_hard_delete on ...;
--          (columns can stay — harmless.)
-- =============================================================================
