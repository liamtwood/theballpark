-- Rebuild migration 0065 — freeze_document_lines(): the server-side writer for the
-- SOW line snapshot. pV2-SOW-01 (audit #1, Liam 2026-11-19).
--
-- project_document_lines is SELECT-only to web_app_user BY DESIGN (append-only /
-- server-side-only, like signatures — 0039 grant + the 0040 "owner direct INSERT =
-- DENIED" test). So the JS snapshot's direct DELETE/INSERT silently failed under the
-- request-pinned web_app_user client, and an accepted ("Fully Executed") SOW was
-- NEVER frozen — it kept rendering the live thread. This SECURITY DEFINER does the
-- DELETE + INSERT atomically (one function = one implicit txn), gated to a party via
-- review_comment_is_party, replacing exactly one document's rows from the
-- caller-computed line set. The caller is the AUTHOR (co_approve / author self-heal),
-- so the lines were read under a consistent org context.
CREATE OR REPLACE FUNCTION public.freeze_document_lines(p_doc_id uuid, p_lines jsonb)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF NOT public.review_comment_is_party('sow', p_doc_id) THEN
    RAISE EXCEPTION 'not a party to this document';
  END IF;
  DELETE FROM project_document_lines WHERE document_id = p_doc_id;
  INSERT INTO project_document_lines
    (org_id, document_id, project_item_id, name, spec, quantity, unit, unit_price, line_total,
     currency, source, approval_date, sku, unit_size, variant, variant_description, install_description)
  SELECT (x->>'org_id')::uuid, p_doc_id, (x->>'project_item_id')::uuid, x->>'name', x->>'spec',
         (x->>'quantity')::numeric, x->>'unit', (x->>'unit_price')::numeric, (x->>'line_total')::numeric,
         x->>'currency', x->>'source', (x->>'approval_date')::timestamptz, x->>'sku', x->>'unit_size',
         x->>'variant', x->>'variant_description', x->>'install_description'
    FROM jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) AS x;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;

GRANT EXECUTE ON FUNCTION public.freeze_document_lines(uuid, jsonb) TO web_app_user;
