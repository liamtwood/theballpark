-- 0013_security_fr00215.sql — close the admin cross-org WRITE backdoor (FR-00215).
--
-- Rule (DATA-MODEL-REDESIGN "Access & security model"): WRITE requires
-- org_id = app_current_org(). A ballpark admin keeps cross_org_view (READ via the
-- app_is_admin() branch in USING) but may NOT author another org's content — edit
-- rights come only from a user_orgs seat (onboarding-create grants one; owner grants
-- one). Moderation (approve/reject item, suspend/approve org) is a narrow, explicit
-- escape via the app.svc_moderate GUC — NOT the role.
--
-- TWO-STAGE: this slice closes UPDATE (the dangerous half — tampering/approving
-- others' content). INSERT keeps the admin escape (onboarding + catalogue-extract
-- concierge import); that closes in the items-rebuild slice when extract switches to
-- current-org. DELETE keeps the admin escape (admin soft-delete / moderation).

-- ── GUC helper: scoped moderation flag (mirrors app_is_admin; PUBLIC-executable) ──
create or replace function public.app_svc_moderate() returns boolean
  language sql stable set search_path = pg_catalog
  as $$ select coalesce(current_setting('app.svc_moderate', true), 'f')::boolean $$;

-- ── orgs: read keeps admin (cross_org_view); UPDATE member-only + moderation(status);
--    INSERT keeps admin (onboarding); DELETE keeps admin ─────────────────────────────
drop policy if exists orgs_self on public.orgs;
create policy orgs_select on public.orgs for select
  using (id = app_current_org() or app_is_admin());
create policy orgs_insert on public.orgs for insert
  with check (id = app_current_org() or app_is_admin());            -- admin onboarding create
create policy orgs_update on public.orgs for update
  using      (id = app_current_org() or app_svc_moderate())
  with check (id = app_current_org()
              or (app_svc_moderate() and status in ('pending','active','suspended','retired')));
create policy orgs_delete on public.orgs for delete
  using (id = app_current_org() or app_is_admin());

-- ── items: items_read stays (public/own/admin). Split the write ALL policy ──────────
drop policy if exists items_write on public.items;
create policy items_insert on public.items for insert
  with check (org_id = app_current_org() or app_is_admin());        -- escape closes in items slice
create policy items_update on public.items for update
  using      (org_id = app_current_org() or app_svc_moderate())
  with check (org_id = app_current_org()
              or (app_svc_moderate() and approval_status in ('draft','pending','approved','rejected')));
create policy items_delete on public.items for delete
  using (org_id = app_current_org() or app_is_admin());

-- ── addresses: org content, no moderation. Read keeps admin; write member-only ──────
drop policy if exists addresses_all on public.addresses;
create policy addresses_select on public.addresses for select
  using (org_id = app_current_org() or app_is_admin());
create policy addresses_insert on public.addresses for insert
  with check (org_id = app_current_org() or app_is_admin());        -- onboarding create
create policy addresses_update on public.addresses for update
  using      (org_id = app_current_org())
  with check (org_id = app_current_org());
create policy addresses_delete on public.addresses for delete
  using (org_id = app_current_org() or app_is_admin());

-- NOTE unchanged (correct by design):
--   categories / reference_codelist* — write = app_is_admin() (shared-reference, admin is owner-curator)
--   user_orgs — write = app_is_admin() OR app_is_org_admin(org_id), self-escalation blocked (the grant path)
