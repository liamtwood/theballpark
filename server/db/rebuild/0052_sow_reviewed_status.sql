-- 0052_sow_reviewed_status.sql — a neutral "Reviewed" marker for the SOW review
-- (Liam 2026-11-18). The counterparty (agent) can mark a SOW Reviewed to signal the
-- review is complete, WITHOUT approving or rejecting. It's additive: Approve / Reject
-- / Revise all still work from 'reviewed' too, so it isn't a dead end.
--
--   • review  — COUNTERPARTY, in_review → reviewed           (NEW: "I've reviewed it")
--   • revise  — AUTHOR,       in_review | reviewed → draft
--   • accept  — COUNTERPARTY, in_review | reviewed → accepted
--   • decline — COUNTERPARTY, in_review | reviewed → declined
--   • send    — AUTHOR,       draft → in_review              (unchanged)

-- Pill value (neutral tone, like in_review). Idempotent (NOT EXISTS guard, like 0049).
INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'sow_status'),
       'reviewed', 'Reviewed', 8, true, jsonb_build_object('color', '#eef2f7')
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status')
    AND x.code = 'reviewed'
);

-- Extend the transition machine (0048) with 'review' + allow decisions from 'reviewed'.
create or replace function public.document_review(p_id uuid, p_action text)
  returns text
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_me     uuid := public.app_current_org();
  v_org    uuid;
  v_status text;
  v_pp     record;
  v_new    text;
begin
  if v_me is null then raise exception 'not a party'; end if;

  select d.org_id, d.status into v_org, v_status
    from public.project_documents d
   where d.id = p_id and d.deleted_at is null and d.type = 'sow';
  if not found then raise exception 'document not found'; end if;

  select pp.org_id, pp.provider_org_id into v_pp
    from public.project_providers pp
    join public.project_documents d on d.project_provider_id = pp.id
   where d.id = p_id and pp.deleted_at is null;
  if v_me not in (v_pp.org_id, v_pp.provider_org_id) then raise exception 'not a party'; end if;

  if p_action = 'send' then
    if v_me <> v_org then raise exception 'only the author can send for review'; end if;
    if v_status <> 'draft' then raise exception 'not a draft'; end if;
    v_new := 'in_review';
  elsif p_action = 'revise' then
    if v_me <> v_org then raise exception 'only the author can revise'; end if;
    if v_status not in ('in_review', 'reviewed') then raise exception 'not in review'; end if;
    v_new := 'draft';
  elsif p_action = 'review' then
    if v_me = v_org then raise exception 'the counterparty marks reviewed, not the author'; end if;
    if v_status <> 'in_review' then raise exception 'not in review'; end if;
    v_new := 'reviewed';
  elsif p_action = 'accept' then
    if v_me = v_org then raise exception 'the counterparty accepts, not the author'; end if;
    if v_status not in ('in_review', 'reviewed') then raise exception 'not in review'; end if;
    v_new := 'accepted';
  elsif p_action = 'decline' then
    if v_me = v_org then raise exception 'the counterparty declines, not the author'; end if;
    if v_status not in ('in_review', 'reviewed') then raise exception 'not in review'; end if;
    v_new := 'declined';
  else
    raise exception 'unsupported action';
  end if;

  update public.project_documents set status = v_new, updated_at = now() where id = p_id;
  return v_new;
end;
$$;
revoke all on function public.document_review(uuid, text) from public;
grant execute on function public.document_review(uuid, text) to web_app_user;
