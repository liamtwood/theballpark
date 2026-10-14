-- Rebuild migration 0019 — SUPPLIER_DIRECTORY (cross-org public supplier surface).
-- Fixes the marketplace showing 0 items cross-org: the item/supplier queries JOIN
-- orgs_public, which is security_invoker=true (ADR-0002/BE-00139) → runs under the
-- caller's orgs RLS → orgs_select is own-org only → a non-admin agent sees only its
-- own org → the INNER JOIN drops every other supplier's items. Widening orgs_select
-- would leak the FULL orgs row (margins/vat/company_number/ref_counter) cross-org and
-- lean on app-layer nulling — forbidden by the acquisition-grade "RLS enforces, not
-- app-nulling" bar. Instead: a dedicated minimal public directory (option c), mirroring
-- the address_locality definer. orgs_select stays UNCHANGED.

-- ═══════════════════════════════════════════════════════════════════════════
-- supplier_directory — the ONLY cross-org public supplier read. Owner-run (NOT
-- security_invoker) + security_barrier so it bypasses orgs RLS and lists ACTIVE
-- SUPPLIERS to any member, exposing ONLY the marketplace-card columns. City/country
-- via the address_locality SECURITY DEFINER (one place for the locality rule). No
-- margins/vat/company_number/ref_counter path exists. web_app_user only; PUBLIC revoked.
-- ═══════════════════════════════════════════════════════════════════════════
drop view if exists public.supplier_directory;
create view public.supplier_directory with (security_barrier = true) as
  select o.id, o.ref, o.name, o.description,
         o.logo_url, o.cover_image_url, o.image_display, o.images,
         loc.city, loc.country
    from public.orgs o
    left join lateral public.address_locality(o.primary_address_id) loc(city, country) on true
   where o.type = 'supplier' and o.status = 'active' and o.deleted_at is null;
revoke all on public.supplier_directory from public;
grant select on public.supplier_directory to web_app_user;

-- ═══════════════════════════════════════════════════════════════════════════
-- orgs_public — TRIM the sensitive columns (defense in depth). A view literally
-- named "public" must never PROJECT default_*_pct / vat_number / company_number /
-- ref_counter / ref_prefix / auto_publish_items / terms_pdf_url — safe today only
-- because it's security_invoker (own-org), but one RLS change would re-leak them.
-- Recreate without them. Stays security_invoker (own-org + counterparty display);
-- the marketplace now reads supplier_directory instead. Remaining consumers
-- (favourite.service: name/cover) use only kept columns.
-- ═══════════════════════════════════════════════════════════════════════════
drop view if exists public.orgs_public;
create view public.orgs_public with (security_invoker = true) as
  select o.id, o.ref, o.name, o.description, o.status, o.type, o.parent_id,
         o.primary_address_id, o.email, o.phone, o.website, o.vat_registered,
         o.logo_url, o.cover_image_url, o.image_display, o.images,
         o.default_currency, o.created_at, o.updated_at,
         loc.city, loc.country
    from public.orgs o
    left join lateral public.address_locality(o.primary_address_id) loc(city, country) on true
   where o.deleted_at is null;
grant select on public.orgs_public to web_app_user;
