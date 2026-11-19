-- 0051_sow_status_approved_rejected_labels.sql — align the SOW review pill wording
-- with the admin item-approval UI (Approve/Reject buttons): the lifecycle VALUES are
-- unchanged (accepted/declined), only the display labels move to Approved/Rejected.
UPDATE public.reference_codelist_values
   SET label = 'Approved'
 WHERE code = 'accepted'
   AND codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status');

UPDATE public.reference_codelist_values
   SET label = 'Rejected'
 WHERE code = 'declined'
   AND codelist_id = (SELECT id FROM public.reference_codelists WHERE name = 'sow_status');
