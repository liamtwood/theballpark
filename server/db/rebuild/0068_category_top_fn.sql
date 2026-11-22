-- Rebuild migration 0068 — category_top(): the TOP-LEVEL (root) ancestor of any
-- category. Items classify at any depth (single-parent tree), so grouping the
-- marketplace / storefront grid by top-level category — and deriving a supplier's
-- categories from what it stocks — both need the root of each item's category.
-- (pV2-MKT-CATGROUP-01, Liam 2026-11-22.)
DROP FUNCTION IF EXISTS public.category_top(uuid);
CREATE OR REPLACE FUNCTION public.category_top(p_category_id uuid)
RETURNS TABLE(id uuid, name text, icon_name text, sort_order integer)
LANGUAGE sql STABLE AS $function$
  WITH RECURSIVE up AS (
    SELECT c.id, c.name, c.icon_name, c.sort_order, c.parent_id
      FROM public.categories c
     WHERE c.id = p_category_id AND c.deleted_at IS NULL
    UNION ALL
    SELECT c.id, c.name, c.icon_name, c.sort_order, c.parent_id
      FROM public.categories c
      JOIN up ON c.id = up.parent_id
     WHERE c.deleted_at IS NULL
  )
  SELECT up.id, up.name, up.icon_name, up.sort_order FROM up WHERE up.parent_id IS NULL LIMIT 1;
$function$;
