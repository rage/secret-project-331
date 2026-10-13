UPDATE credit_registrations
SET state = 'awaiting_verification'
WHERE state = 'partially_registered';
UPDATE credit_registration_events
SET from_state = 'awaiting_verification'
WHERE from_state = 'partially_registered';
UPDATE credit_registration_events
SET to_state = 'awaiting_verification'
WHERE to_state = 'partially_registered';
UPDATE credit_registration_admin_actions
SET before_state = 'awaiting_verification'
WHERE before_state = 'partially_registered';
UPDATE credit_registration_admin_actions
SET after_state = 'awaiting_verification'
WHERE after_state = 'partially_registered';
-- entered_count and left_count are summed as they stand, so moves between the two states count twice.
UPDATE credit_registration_daily_snapshots a
SET count = a.count + p.count,
  entered_count = a.entered_count + p.entered_count,
  left_count = a.left_count + p.left_count
FROM credit_registration_daily_snapshots p
WHERE p.state = 'partially_registered'
  AND a.state = 'awaiting_verification'
  AND a.snapshot_date = p.snapshot_date
  AND a.deleted_at IS NOT DISTINCT FROM p.deleted_at;
UPDATE credit_registration_daily_snapshots p
SET state = 'awaiting_verification'
WHERE p.state = 'partially_registered'
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registration_daily_snapshots a
    WHERE a.state = 'awaiting_verification'
      AND a.snapshot_date = p.snapshot_date
      AND a.deleted_at IS NOT DISTINCT FROM p.deleted_at
  );
DELETE FROM credit_registration_daily_snapshots
WHERE state = 'partially_registered';
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
    'registered',
    'duplicate',
    'not_improved'
  );
COMMENT ON COLUMN credit_registrations.partially_registered_at IS 'When verify first saw only an assessment item attainment for the submission, with the course unit attainment still missing. Cleared on resubmission.';
