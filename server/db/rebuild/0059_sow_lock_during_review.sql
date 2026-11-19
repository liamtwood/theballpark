-- 0059_sow_lock_during_review.sql — once a SOW is out for review it's locked to the
-- agent's turn (Liam 2026-11-18): the author can no longer 'revise' from in_review.
-- Revise is allowed only after the agent hands it back (reviewed) or before the final
-- approval (agent_approved). Everything else unchanged from 0057.
create or replace function public.document_review(p_id uuid, p_action text)
  returns text
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare
  v_me uuid := public.app_current_org();
  v_org uuid; v_status text; v_pp record; v_new text;
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
    if v_status not in ('reviewed', 'agent_approved') then raise exception 'cannot revise while out for review'; end if;
    v_new := 'draft';
  elsif p_action = 'review' then
    if v_me = v_org then raise exception 'the counterparty marks reviewed, not the author'; end if;
    if v_status <> 'in_review' then raise exception 'not in review'; end if;
    v_new := 'reviewed';
  elsif p_action = 'accept' then
    if v_me = v_org then raise exception 'the counterparty approves first, not the author'; end if;
    if v_status not in ('in_review', 'reviewed') then raise exception 'not in review'; end if;
    v_new := 'agent_approved';
  elsif p_action = 'co_approve' then
    if v_me <> v_org then raise exception 'the author gives the final approval'; end if;
    if v_status <> 'agent_approved' then raise exception 'not awaiting the author approval'; end if;
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
