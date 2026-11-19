-- Rebuild migration 0061 — retire the old sign-flow SOW statuses. pV2-SOW-01.
--
-- The sign flow (counterparty signs → counterparty_signed → author counter-signs →
-- executed) was replaced by the two-step review/approval flow: send → agent accept
-- (agent_approved / "SOW Approved") → supplier co_approve (accepted / "Fully
-- Executed"). The sign route + service + panel UI are gone; the line-freeze moved
-- from 'executed' to 'accepted'. These three sow_status codes are now unreachable
-- (no live SOW uses them) — soft-retire them so they drop out of the codelist UI.
-- Idempotent. (Liam 2026-11-19.)
UPDATE reference_codelist_values cv
   SET deleted_at = now(), is_active = false, updated_at = now()
  FROM reference_codelists cl
 WHERE cl.id = cv.codelist_id
   AND cl.name = 'sow_status'
   AND cv.code IN ('ready_to_sign', 'counterparty_signed', 'executed')
   AND cv.deleted_at IS NULL;
