-- 0048_document_review_transitions.sql — SOW review lifecycle transitions (pV2-SOW-01).
--
-- Draft → In review → Accepted | Declined, with an author "revise" back to Draft.
-- ONE SECURITY DEFINER entry point (mirrors document_sign): the party is DERIVED
-- server-side from (app_current_org, d.org_id, engagement) — never a client role —
-- and each transition is gated to the right party + current status:
--   • send    — AUTHOR,        draft     → in_review   (supplier makes it visible)
--   • revise  — AUTHOR,        in_review → draft        (pull back to edit)
--   • accept  — COUNTERPARTY,  in_review → accepted     (the agent agrees)
--   • decline — COUNTERPARTY,  in_review → declined
-- Fail-closed on the session GUC (NULLIF→NULL → not-a-party). The counterparty has
-- no RLS write path to project_documents, so this definer is their only route; the
-- author could self-UPDATE via _all but goes through here too for one audited path.
-- NB: line snapshot + the frozen "rubber stamp" PDF on accept are the owed follow-up.

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
    if v_status <> 'in_review' then raise exception 'not in review'; end if;
    v_new := 'draft';
  elsif p_action = 'accept' then
    if v_me = v_org then raise exception 'the counterparty accepts, not the author'; end if;
    if v_status <> 'in_review' then raise exception 'not in review'; end if;
    v_new := 'accepted';
  elsif p_action = 'decline' then
    if v_me = v_org then raise exception 'the counterparty declines, not the author'; end if;
    if v_status <> 'in_review' then raise exception 'not in review'; end if;
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
