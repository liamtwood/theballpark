-- 0017 — items moderation hardening (audit 2026-10-12: M2 + L1).
--
-- M2: the items_update RLS WITH CHECK let app_svc_moderate() pass for ANY column
-- change as long as approval_status stayed a valid enum (a tautology — the column
-- CHECK already guarantees that). So a cross-org moderation write could edit name/
-- price/etc. on another org's item. RLS can't compare OLD vs NEW, so a BEFORE UPDATE
-- trigger enforces column-scope: when svc_moderate is acting on an item NOT in the
-- current org, ONLY approval_status (+ the audit updated_*) may change.
--
-- L1: align items_delete to the same moderation gate as items_update — a cross-org
-- admin delete is a moderation action (reject), so require svc_moderate, not the bare
-- app_is_admin() escape (consistency with the closed write model).

-- ── M2 — svc_moderate column guard ──────────────────────────────────────────
create or replace function public.items_svc_moderate_guard() returns trigger
language plpgsql as $$
declare probe public.items;
begin
  -- Only relevant to a cross-org moderation write (svc_moderate, row not in current org).
  if public.app_svc_moderate() and new.org_id <> public.app_current_org() then
    -- Moderation may change approval_status OR soft-delete (deleted_at) — a reject and
    -- a takedown are both moderation. Normalise those + the audit stamps, then compare
    -- the whole row: anything else differing means the escape is editing owner content.
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

drop trigger if exists items_svc_moderate_guard on public.items;
create trigger items_svc_moderate_guard before update on public.items
  for each row execute function public.items_svc_moderate_guard();

-- ── L1 — delete uses the moderation gate, not the admin escape ───────────────
drop policy if exists items_delete on public.items;
create policy items_delete on public.items for delete
  using (org_id = public.app_current_org() or public.app_svc_moderate());
