-- 0024_items_refresh_images.sql — cross-org image refresh (pV2-ITEM-BULK-ACTIONS-01).
--
-- The Refresh-Images bulk action re-fetches an item's external_url and re-selects its
-- photos (zero AI), writing items.images IN PLACE. For an ADMIN fixing a supplier's
-- imageless pulled items this is a CROSS-ORG write, which FR-00215 (0013) closed and
-- the 0017 svc_moderate guard confines to approval_status/deleted_at.
--
-- Option D (designer ruling, Liam-approved — least privilege): a SEPARATE narrow GUC
-- `app.svc_refresh`, set ONLY by the refresh runner, that permits writing `images`
-- ONLY — never approval_status/deleted_at (those stay under svc_moderate). So a refresh
-- bug can at worst rewrite an image; it can never approve, reject or delete a supplier's
-- item. Reading the (pending, non-public) item still goes through app_is_admin() in
-- items_select — svc_refresh grants WRITE (images) only, not READ.

-- ── GUC helper: scoped image-refresh flag (mirrors app_svc_moderate) ─────────────────
create or replace function public.app_svc_refresh() returns boolean
  language sql stable set search_path = pg_catalog
  -- NULLIF handles the empty-string GUC a pooled connection can carry (same trap the
  -- app_svc_moderate / RLS GUC helpers guard against).
  as $$ select coalesce(nullif(current_setting('app.svc_refresh', true), ''), 'f')::boolean $$;

-- ── items_update: admit the svc_refresh cross-org write (column-confined by the trigger) ─
-- Reproduces the 0013 policy and ADDS the svc_refresh branch. The WITH CHECK branch for
-- svc_refresh is permissive (the BEFORE-UPDATE trigger below is the real column guard —
-- same division of labour as svc_moderate, whose enum check is a tautology).
drop policy if exists items_update on public.items;
create policy items_update on public.items for update
  using      (org_id = app_current_org() or app_svc_moderate() or app_svc_refresh())
  with check (org_id = app_current_org()
              or (app_svc_moderate() and approval_status in ('draft','pending','approved','rejected'))
              or app_svc_refresh());

-- ── column guard: svc_refresh → images only; svc_moderate → approval_status/deleted_at ─
-- Extends 0017's guard with a svc_refresh branch. RLS can't compare OLD vs NEW, so this
-- BEFORE UPDATE trigger enforces column-scope for BOTH escapes on a cross-org row. The
-- two GUCs are set independently (the refresh runner sets only svc_refresh; withModeration
-- only svc_moderate), so they're handled as separate branches.
create or replace function public.items_svc_moderate_guard() returns trigger
language plpgsql as $$
declare probe public.items;
begin
  if public.app_svc_refresh() and new.org_id <> public.app_current_org() then
    -- Image refresh may change ONLY images (+ the audit stamps). Anything else differing
    -- means the escape is editing owner content — reject it.
    probe := new;
    probe.images := old.images;
    probe.updated_at := old.updated_at;
    probe.updated_by := old.updated_by;
    if row(probe.*) is distinct from row(old.*) then
      raise exception 'svc_refresh may change only images (cross-org image refresh)'
        using errcode = 'check_violation';
    end if;
  elsif public.app_svc_moderate() and new.org_id <> public.app_current_org() then
    -- Moderation may change approval_status OR soft-delete (deleted_at) — unchanged from 0017.
    probe := new;
    probe.approval_status := old.approval_status;
    probe.deleted_at := old.deleted_at;
    probe.deleted_by := old.deleted_by;
    probe.updated_at := old.updated_at;
    probe.updated_by := old.updated_by;
    if row(probe.*) is distinct from row(old.*) then
      raise exception 'svc_moderate may change only approval_status / deleted_at (cross-org moderation)'
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end $$;
-- Trigger already exists from 0017 (same function name) — the CREATE OR REPLACE above
-- re-points it; re-create defensively in case 0024 runs on a DB that lacks it.
drop trigger if exists items_svc_moderate_guard on public.items;
create trigger items_svc_moderate_guard before update on public.items
  for each row execute function public.items_svc_moderate_guard();
