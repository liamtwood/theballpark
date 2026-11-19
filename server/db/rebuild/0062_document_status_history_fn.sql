-- Rebuild migration 0062 — document_status_history(): cross-org actor names for
-- the SOW/review History view. pV2-SOW-01.
--
-- The plain history join to `users` runs under the VIEWER's RLS (users is RLS-on),
-- so a supplier cannot resolve the AGENCY's user names (and vice versa) → the
-- counterparty's rows (Reviewed / Approved) showed "—". This SECURITY DEFINER
-- resolver returns the same rows with names resolved, GATED to a party via
-- review_comment_is_party (a non-party gets zero rows). A contract audit trail
-- should name who acted, across both parties. (Liam 2026-11-19.)
CREATE OR REPLACE FUNCTION public.document_status_history(p_entity_type text, p_entity_id uuid)
RETURNS TABLE(status text, event text, changed_at timestamptz, changed_by uuid, changed_by_name text, commenter_count integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT sh.status::text, sh.event::text, sh.changed_at, sh.changed_by, u.name::text,
         COALESCE(cc.n, 0)::int
    FROM status_history sh
    LEFT JOIN users u ON u.id = sh.changed_by
    LEFT JOIN (
      SELECT author_user_id, count(*)::int AS n
        FROM review_comments
       WHERE entity_type = p_entity_type AND entity_id = p_entity_id AND status = 'open'
       GROUP BY author_user_id
    ) cc ON cc.author_user_id = sh.changed_by
   WHERE sh.entity_type = p_entity_type AND sh.entity_id = p_entity_id
     AND public.review_comment_is_party(p_entity_type, p_entity_id)
   ORDER BY sh.changed_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.document_status_history(text, uuid) TO web_app_user;
