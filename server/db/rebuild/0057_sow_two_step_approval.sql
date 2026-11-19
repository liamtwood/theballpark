-- 0057_sow_two_step_approval.sql — BOTH parties approve (Liam 2026-11-18).
-- The agent approves first (SOW Review/Reviewed → agent_approved), then the supplier
-- (author) gives the final approval (agent_approved → accepted). Mirrors the
-- sign/counter-sign handshake. Revise still works from agent_approved (author pulls
-- back). New action: co_approve (author's final approval).
--
--   send     — author,       draft → in_review
--   review   — agent,        in_review → reviewed
--   accept   — agent,        in_review | reviewed → agent_approved   (CHANGED target)
--   co_approve — author,     agent_approved → accepted               (NEW, final)
--   revise   — author,       in_review | reviewed | agent_approved → draft
--   decline  — agent,        in_review | reviewed → declined

-- New pill value (one-sided approval). Idempotent.
INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'sow_status'),
       'agent_approved', 'Agent Approved', 9, true, jsonb_build_object('color', '#eef2f7')
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status')
    AND x.code = 'agent_approved'
);

-- Transition machine — two-step approval.
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
    if v_status not in ('in_review', 'reviewed', 'agent_approved') then raise exception 'not in review'; end if;
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

-- History event labels — add the agent-approved step; accepted = final (both approved).
create or replace function public.log_sow_status() returns trigger
  language plpgsql security definer
  set search_path = public, pg_temp
as $$
declare v_event text;
begin
  if NEW.type <> 'sow' then return NEW; end if;
  if TG_OP = 'INSERT' then
    v_event := 'Created';
  elsif NEW.status is distinct from OLD.status then
    v_event := case NEW.status
      when 'in_review'           then 'Send for review'
      when 'reviewed'            then 'Reviewed'
      when 'agent_approved'      then 'Agent approved'
      when 'accepted'            then 'Approved'
      when 'declined'            then 'Rejected'
      when 'draft'               then 'Revised'
      when 'counterparty_signed' then 'Signed'
      when 'executed'            then 'Executed'
      else initcap(replace(NEW.status, '_', ' '))
    end;
  else
    return NEW;
  end if;
  insert into public.status_history (entity_type, entity_id, status, event, changed_by)
  values ('sow', NEW.id, NEW.status, v_event, public.app_current_user_id());
  return NEW;
end;
$$;
