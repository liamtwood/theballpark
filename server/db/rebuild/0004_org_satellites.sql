-- Rebuild migration 0004 — org satellites + read view (completes the org DB layer).
-- org_subscription (C, 1-N history) · org_credits (E, append-only ledger) ·
-- org_favourites (C) · orgs_public (security_invoker view, ADR-0002).
-- Columns that FK to later-slice tables (project_id, message_id, ref_id) are plain
-- uuids now; their FKs are added when those slices land.

-- ===== org_subscription — current plan = the active row; change plan = new row
create table public.org_subscription (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  tier text not null,                              -- ballpark codelist (validated when codelist slice lands)
  status text not null default 'active' check (status in ('trialing','active','past_due','cancelled','expired')),
  started_at timestamptz not null default now(),
  ended_at   timestamptz,                          -- null = current
  monthly_allowance integer check (monthly_allowance >= 0),
  created_at timestamptz not null default now(), created_by uuid not null references public.users(id),
  updated_at timestamptz not null default now(), updated_by uuid references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create unique index org_subscription_active_uidx on public.org_subscription (org_id)
  where status = 'active' and deleted_at is null;
create index org_subscription_org_idx on public.org_subscription (org_id) where deleted_at is null;
alter table public.org_subscription enable row level security;
alter table public.org_subscription force row level security;
create policy org_subscription_all on public.org_subscription for all
  using (org_id = public.app_current_org() or public.app_is_admin())
  with check (org_id = public.app_current_org() or public.app_is_admin());
grant select, insert, update, delete on public.org_subscription to web_app_user;

-- ===== org_credits — APPEND-ONLY ledger (class E). Balance = SUM. Correction = reversing entry.
create table public.org_credits (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  project_id uuid,                                 -- FK when project slice lands
  supplier_org_id uuid references public.orgs(id),
  user_id uuid references public.users(id),
  amount integer not null check (amount >= 0),     -- magnitude; sign comes from direction
  direction text not null check (direction in ('credit','debit')),
  reason text not null check (reason in ('subscription','spend','referral','refund','bonus')),
  description text,
  message_id uuid,                                 -- FK when messaging slice lands
  created_at timestamptz not null default now(),
  created_by uuid not null references public.users(id)
  -- NO updated_*/deleted_* — immutability enforced by their absence (class E)
);
create index org_credits_org_idx on public.org_credits (org_id);
alter table public.org_credits enable row level security;
alter table public.org_credits force row level security;
create policy org_credits_read on public.org_credits for select
  using (org_id = public.app_current_org() or supplier_org_id = public.app_current_org() or public.app_is_admin());
create policy org_credits_insert on public.org_credits for insert
  with check (public.app_is_admin() or org_id = public.app_current_org());
grant select, insert on public.org_credits to web_app_user;   -- no update/delete on a ledger

-- ===== org_favourites — polymorphic saved list; re-favourite reactivates
create table public.org_favourites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs(id),
  type text not null check (type in ('item','supplier','category')),
  ref_id uuid not null,                            -- polymorphic target (no FK)
  created_at timestamptz not null default now(), created_by uuid not null references public.users(id),
  deleted_at timestamptz, deleted_by uuid references public.users(id)
);
create unique index org_favourites_uidx on public.org_favourites (org_id, type, ref_id) where deleted_at is null;
alter table public.org_favourites enable row level security;
alter table public.org_favourites force row level security;
create policy org_favourites_all on public.org_favourites for all
  using (org_id = public.app_current_org() or public.app_is_admin())
  with check (org_id = public.app_current_org() or public.app_is_admin());
grant select, insert, update, delete on public.org_favourites to web_app_user;

-- ===== orgs_public — read view (security_invoker: RLS still applies), audit-by hidden
create view public.orgs_public with (security_invoker = true) as
  select id, ref, name, description, status, type, parent_id, primary_address_id,
         email, phone, website, company_number, vat_number, vat_registered,
         logo_url, cover_image_url, image_display, images, terms_pdf_url,
         default_currency, default_margin_pct, default_contingency_pct, default_vat_pct,
         default_insurance_pct, auto_publish_items, ref_prefix, ref_counter,
         created_at, updated_at
    from public.orgs
   where deleted_at is null;
grant select on public.orgs_public to web_app_user;
