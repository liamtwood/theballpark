-- Rebuild migration 0023 — INBOX / engagement RLS widenings (Stage 3).
-- The 0018/0020 project-children policies are AGENCY-ONLY; 0018 explicitly flags
-- "READ: owner agency + admin now. S3 widens this to suppliers engaged via
-- project_providers." This migration makes that widening — all ADDITIVE
-- (CREATE POLICY only; multiple permissive policies OR together), so the agency
-- paths are untouched and WRITE on the project children stays agency-only.
--
-- An ENGAGED provider (a live project_providers row with provider_org_id =
-- app_current_org()) gains READ on the project + its categories, READ on the
-- project_items it's actually been briefed on (scoped by a message relation it's
-- party to — not the whole project), and READ+WRITE on ITS OWN overlay rows
-- (its quote). messages/relations/events already allow both parties (0022).
--
-- Plus org_contact(): the symmetric cross-org display for the SUPPLIER→AGENCY
-- direction (supplier_directory only exposes suppliers; orgs RLS is own-org).
-- A SECURITY DEFINER gated to a shared engagement, mirroring address_locality.

-- ═══════════════════════════════════════════════════════════════════════════
-- projects — an engaged provider may READ the project (their inbox home needs
-- the name / cover / event facts). WRITE stays agency-only (0018 unchanged).
-- ═══════════════════════════════════════════════════════════════════════════
create policy projects_provider_read on public.projects for select
  using (exists (select 1 from public.project_providers pp
                  where pp.project_id = id
                    and pp.provider_org_id = public.app_current_org()
                    and pp.deleted_at is null));

-- ═══════════════════════════════════════════════════════════════════════════
-- project_categories — an engaged provider may READ the project's category
-- buckets (thread labels). WRITE stays agency-only (the 0018 _all policy).
-- ═══════════════════════════════════════════════════════════════════════════
create policy project_categories_provider_read on public.project_categories for select
  using (exists (select 1 from public.project_providers pp
                  where pp.project_id = project_id
                    and pp.provider_org_id = public.app_current_org()
                    and pp.deleted_at is null));

-- ═══════════════════════════════════════════════════════════════════════════
-- project_items — a provider may READ only the items it has actually been
-- messaged about (a message_relation on a message it is a party to). This is
-- the precise "only your briefed items" scope (not the whole project), so a
-- competitor's un-briefed lines stay invisible. WRITE stays agency-only (0020).
-- ═══════════════════════════════════════════════════════════════════════════
create policy project_items_provider_read on public.project_items for select
  using (exists (select 1 from public.message_relations mr
                   join public.messages m on m.id = mr.message_id and m.deleted_at is null
                  where mr.project_item_id = id
                    and public.app_current_org() in (m.from_org_id, m.to_org_id)));

-- ═══════════════════════════════════════════════════════════════════════════
-- project_item_quotes — a provider may READ + WRITE its OWN overlay rows (the
-- rows tied to its engagement). The agency keeps full access via the 0020 _all
-- policy; this ADDS the provider's self-service on its quote. org_id on the row
-- is still the agency (sacred) — this branch gates on project_provider_id, not
-- org_id, so a supplier insert with org_id = the agency passes.
-- ═══════════════════════════════════════════════════════════════════════════
create policy project_item_quotes_provider on public.project_item_quotes for all
  using      (exists (select 1 from public.project_providers pp
                        where pp.id = project_provider_id
                          and pp.provider_org_id = public.app_current_org()
                          and pp.deleted_at is null))
  with check (exists (select 1 from public.project_providers pp
                        where pp.id = project_provider_id
                          and pp.provider_org_id = public.app_current_org()
                          and pp.deleted_at is null));

-- ═══════════════════════════════════════════════════════════════════════════
-- org_contact — cross-org counterparty display for the SUPPLIER→AGENCY direction
-- (the agency isn't in supplier_directory, and orgs RLS is own-org-only). A
-- narrow SECURITY DEFINER that returns ONLY name / logo_url / city, and ONLY for
-- an org the caller SHARES A PROJECT ENGAGEMENT with (either role). The sharing
-- test lives INSIDE the definer so the caller can't widen it; search_path PINNED
-- (mandatory for an RLS-bypassing definer). Mirrors address_locality (0004).
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.org_contact(target uuid)
  returns table(id uuid, name text, logo_url text, city text)
  language sql stable security definer
  set search_path = public, pg_temp
  as $$
    select o.id, o.name, o.logo_url, loc.city
      from public.orgs o
      left join lateral public.address_locality(o.primary_address_id) loc(city, country) on true
     where o.id = target
       and o.deleted_at is null
       and exists (
         select 1 from public.project_providers pp
          where pp.deleted_at is null
            and ((pp.org_id = public.app_current_org() and pp.provider_org_id = target)
              or (pp.provider_org_id = public.app_current_org() and pp.org_id = target)))
  $$;
-- Lock it down: a definer defaults to EXECUTE for PUBLIC — revoke, then grant
-- only the runtime role (RLS-subject everywhere else; this is the one bypass).
revoke all on function public.org_contact(uuid) from public;
grant execute on function public.org_contact(uuid) to web_app_user;
