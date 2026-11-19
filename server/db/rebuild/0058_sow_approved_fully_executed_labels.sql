-- 0058_sow_approved_fully_executed_labels.sql — final-state wording (Liam 2026-11-18).
-- Agent's approval reads "SOW Approved"; the supplier's final approval reads
-- "Fully Executed". Values unchanged (agent_approved / accepted); labels + the
-- history event text only.
UPDATE public.reference_codelist_values v SET label = m.label
FROM (VALUES
  ('agent_approved', 'SOW Approved'),
  ('accepted',       'Fully Executed')
) AS m(code, label)
WHERE v.code = m.code
  AND v.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status');

-- History event text: agent_approved = "Approved"; accepted = "Fully Executed".
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
      when 'agent_approved'      then 'Approved'
      when 'accepted'            then 'Fully Executed'
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
