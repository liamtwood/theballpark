-- Rebuild migration 0042 — SOW parties resolver (pV2-SOW-01, Phase 2).
-- Gated cross-org resolution of both SOW parties' legal details (name, company
-- number, VAT, registered address) for the Section 2 "SOW Parties" block.
-- SECURITY DEFINER, org_contact-shaped: returns the two orgs on an engagement
-- ONLY to a caller who is a party to that engagement. Company number + registered
-- address are public-record company data; the gate still scopes it to the deal.
-- Designer re-audit: the cross-org parties resolution they flagged in the Phase-1
-- re-audit — ping on this slice. APPLIED to ballpark-v2-dev 2026-11-16 (Supabase MCP).

create or replace function public.sow_parties(p_project_provider_id uuid)
  returns table (
    org_id uuid, role text, name text, company_number text, vat_number text,
    line1 text, line2 text, city text, region text, postcode text, country text
  )
  language sql security definer
  set search_path = public, pg_temp
  stable
as $$
  select o.id,
         case when o.id = pp.org_id then 'agency' else 'supplier' end as role,
         o.name, o.company_number, o.vat_number,
         a.line1, a.line2, a.city, a.region, a.postcode, a.country
    from public.project_providers pp
    join public.orgs o on o.id in (pp.org_id, pp.provider_org_id)
    left join public.addresses a
      on a.id = o.primary_address_id and a.deleted_at is null
   where pp.id = p_project_provider_id
     and pp.deleted_at is null
     and public.app_current_org() in (pp.org_id, pp.provider_org_id);
$$;
revoke all on function public.sow_parties(uuid) from public;
grant execute on function public.sow_parties(uuid) to web_app_user;
