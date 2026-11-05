-- 0031_bp_brand_config.sql
-- Legacy-only table gap (table-gap audit 2026-11-04): bp_brand_config is CREATEd
-- by the legacy migrate-schemas.js but was never ported to server/db/rebuild/*,
-- so it's missing on every run.js env (dev2/preview/prod) — brand.js (GET
-- /api/brand) logs "relation \"bp_brand_config\" does not exist" in a loop.
-- A GLOBAL key/value brand registry: its values land on the --bp-* CSS tokens at
-- client bootstrap (font / gradient / text colour, DB-changeable without a
-- redeploy). Registry → rows never go away, no deleted_at. Reads are PUBLIC;
-- writes are platform-admin only (same posture as reference_codelists, 0006).
-- Seeded with the pV2-01f brand values (match client-v2/styles.css fallbacks →
-- no visual change on first load). Idempotent.

create table if not exists public.bp_brand_config (
  key        text primary key,
  value      text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

insert into public.bp_brand_config (key, value) values
  ('font_pair',  'ui-sans-serif, system-ui, -apple-system, ''Segoe UI'', Roboto, sans-serif'),
  ('gradient',   'linear-gradient(135deg, #d63384 0%, #16a34a 100%)'),
  ('text_color', '#1f2937')
on conflict (key) do nothing;

alter table public.bp_brand_config enable row level security;
alter table public.bp_brand_config force row level security;

drop policy if exists bp_brand_config_read on public.bp_brand_config;
create policy bp_brand_config_read on public.bp_brand_config for select using (true);

drop policy if exists bp_brand_config_write on public.bp_brand_config;
create policy bp_brand_config_write on public.bp_brand_config for all
  using (public.app_is_admin()) with check (public.app_is_admin());

grant select, insert, update, delete on public.bp_brand_config to web_app_user;
