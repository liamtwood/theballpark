-- 0028_line_turn_codes.sql
-- Two axes on one line pill (Liam 2026-10-30). line_display_status already carries
-- the DEAL state (the last price/accept ACTION: to_agree / quoted / new_cost /
-- you_/they_accepted / all_confirmed / booked / declined). This adds the CONVERSATION
-- TURN as two more codes of the SAME list, used when the last event on a line is a
-- MESSAGE-ONLY (no price action):
--   reply_needed — the other party sent the last message → it's on you
--   replied      — you sent the last message → awaiting them
-- Separately, "needsYou" (the other party sent the last message on a non-terminal
-- line) renders the pill BOLD regardless of which code shows — so a deal code like
-- new_cost reads bold when their action is the thing awaiting you. Turn is derived
-- from messages/events, never stored.
-- Idempotent: safe to re-run / safe on an env that already has these.

-- new turn codes on line_display_status --------------------------------------
INSERT INTO public.reference_codelist_values (codelist_id, code, label, sort_order, is_active, meta)
SELECT (SELECT id FROM public.reference_codelists WHERE name = 'line_display_status'),
       v.code, v.label, v.sort_order, true, jsonb_build_object('color', v.color)
FROM (VALUES
  ('reply_needed', 'Reply needed', 9,  '#f8fafc'),
  ('replied',      'Replied',      10, '#f8fafc')
) AS v(code, label, sort_order, color)
WHERE NOT EXISTS (
  SELECT 1 FROM public.reference_codelist_values x
  WHERE x.codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'line_display_status')
    AND x.code = v.code
);
