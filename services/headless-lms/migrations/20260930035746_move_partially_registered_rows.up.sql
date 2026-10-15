UPDATE credit_registrations
SET state = 'partially_registered',
  state_entered_at = partially_registered_at
WHERE state = 'awaiting_verification'
  AND partially_registered_at IS NOT NULL;
DROP INDEX uq_credit_registrations_person_module;
CREATE UNIQUE INDEX uq_credit_registrations_person_module ON credit_registrations (sisu_person_id, course_module_id)
WHERE sisu_person_id IS NOT NULL
  AND deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND pending_superseded_by_id IS NULL
  AND state IN (
    'submitting',
    'submission_uncertain',
    'awaiting_verification',
    'partially_registered',
    'registered',
    'duplicate',
    'not_improved'
  );
COMMENT ON COLUMN credit_registrations.partially_registered_at IS 'When verify first saw only an assessment item attainment for the submission, which moved the row to partially_registered. Kept while the row polls on, so the wait for the course unit attainment is measured from the first sighting. Cleared on resubmission.';
