-- Rebuild migration 0067 — gen_bpin() must be SECURITY DEFINER. pV2-BPIN-01 fix.
--
-- 0060 created gen_bpin() as the items.bpin DEFAULT but left it SECURITY INVOKER,
-- so an INSERT by the request-pinned web_app_user role ran nextval('items_bpin_seq')
-- as web_app_user — which has no USAGE on the sequence → "permission denied for
-- sequence items_bpin_seq", breaking every app-side item create/edit. (The MCP/owner
-- loader never hit it.) Make the generator run as its owner (postgres, which owns the
-- sequence) so the sequence stays restricted from the app role. SET search_path keeps
-- the definer safe. (Liam 2026-11-20.)
CREATE OR REPLACE FUNCTION public.gen_bpin()
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE
  n         bigint  := nextval('public.items_bpin_seq');
  k         numeric := 679535555967;
  c         numeric := 777777777777;
  scrambled bigint  := ((n::numeric * k + c) % 1099511627776)::bigint;
  alphabet  text := '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  out       text := '';
  i         int;
BEGIN
  FOR i IN 0..7 LOOP
    out := substr(alphabet, (scrambled & 31)::int + 1, 1) || out;
    scrambled := scrambled >> 5;
  END LOOP;
  RETURN 'BP' || out;
END $function$;
