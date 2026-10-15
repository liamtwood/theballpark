-- Rebuild migration 0021 — add `website` to supplier_directory.
-- The two-page Quick View (pV2-STORE-QUICKVIEW-SUPPLIER-01) surfaces the supplier's
-- website on the profile pane. website is public supplier info (it's on their public
-- profile), so it belongs in the owner-run active-supplier directory. Additive
-- (drop+recreate; the view can't add a column via CREATE OR REPLACE). Existing
-- consumers select explicit columns, so adding one is safe.
drop view if exists public.supplier_directory;
create view public.supplier_directory with (security_barrier = true) as
  select o.id, o.ref, o.name, o.description, o.website,
         o.logo_url, o.cover_image_url, o.image_display, o.images,
         loc.city, loc.country
    from public.orgs o
    left join lateral public.address_locality(o.primary_address_id) loc(city, country) on true
   where o.type = 'supplier' and o.status = 'active' and o.deleted_at is null;
revoke all on public.supplier_directory from public;
grant select on public.supplier_directory to web_app_user;
