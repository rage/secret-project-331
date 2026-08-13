-- A row that only ever recorded a failure has no token to make the columns mandatory again with.
DELETE FROM open_university_product_access_tokens
WHERE access_token IS NULL;

ALTER TABLE open_university_product_access_tokens
ALTER COLUMN last_refreshed_at
SET DEFAULT now(),
  ALTER COLUMN last_refreshed_at
SET NOT NULL,
  ALTER COLUMN document_state
SET NOT NULL,
  ALTER COLUMN state
SET NOT NULL,
  ALTER COLUMN access_token
SET NOT NULL;

COMMENT ON COLUMN open_university_product_access_tokens.access_token IS 'The token itself. A secret: it must never reach a log line or a stored Suotar body sample.';
COMMENT ON COLUMN open_university_product_access_tokens.state IS 'Token state as Suotar reports it.';
COMMENT ON COLUMN open_university_product_access_tokens.document_state IS 'Document state as Suotar reports it.';
COMMENT ON COLUMN open_university_product_access_tokens.last_refreshed_at IS 'When the token was last successfully refreshed.';

ALTER TABLE course_module_suotar_realisations DROP COLUMN consecutive_listing_failures,
  DROP COLUMN last_listing_error,
  DROP COLUMN last_listing_attempted_at;

DROP INDEX IF EXISTS cmc_registered_to_study_registries_completion_registrar_idx;

-- A row this platform registered itself has no registrar to name once the column is mandatory again,
-- and the mirror phase recreates it from the registration it derives from, so dropping it loses
-- nothing. The registrar row that used to stand in for the platform is deliberately not brought back:
-- no code reads it, and the migration that seeded it deletes it by id, which then matches nothing.
DELETE FROM course_module_completion_registered_to_study_registries
WHERE study_registry_registrar_id IS NULL;

ALTER TABLE course_module_completion_registered_to_study_registries
ALTER COLUMN study_registry_registrar_id SET NOT NULL;

COMMENT ON COLUMN course_module_completion_registered_to_study_registries.study_registry_registrar_id IS 'Registrar that registered this course module completion.';

-- Enum values cannot be removed, so the type is rebuilt without it. A row still in flight through
-- resolve-enrolments folds back into checking_enrolment, the state it would have landed in anyway.
UPDATE credit_registrations
SET state = 'checking_enrolment'
WHERE state = 'resolving_enrolment';

UPDATE credit_registration_events
SET from_state = 'checking_enrolment'
WHERE from_state = 'resolving_enrolment';

UPDATE credit_registration_events
SET to_state = 'checking_enrolment'
WHERE to_state = 'resolving_enrolment';

UPDATE credit_registration_admin_actions
SET before_state = 'checking_enrolment'
WHERE before_state = 'resolving_enrolment';

UPDATE credit_registration_admin_actions
SET after_state = 'checking_enrolment'
WHERE after_state = 'resolving_enrolment';

-- Folded rather than renamed: on a day both states have a row, renaming collides with
-- uq_credit_registration_daily_snapshots and the rollback fails half-applied.
UPDATE credit_registration_daily_snapshots target
SET count = target.count + source.count,
  entered_count = target.entered_count + source.entered_count,
  left_count = target.left_count + source.left_count
FROM credit_registration_daily_snapshots source
WHERE source.state = 'resolving_enrolment'
  AND target.state = 'checking_enrolment'
  AND target.snapshot_date = source.snapshot_date
  AND target.deleted_at IS NOT DISTINCT FROM source.deleted_at;

DELETE FROM credit_registration_daily_snapshots source
WHERE source.state = 'resolving_enrolment'
  AND EXISTS (
    SELECT 1
    FROM credit_registration_daily_snapshots target
    WHERE target.state = 'checking_enrolment'
      AND target.snapshot_date = source.snapshot_date
      AND target.deleted_at IS NOT DISTINCT FROM source.deleted_at
  );

UPDATE credit_registration_daily_snapshots
SET state = 'checking_enrolment'
WHERE state = 'resolving_enrolment';

ALTER TABLE credit_registrations
ALTER COLUMN state DROP DEFAULT;

-- Its WHERE clause compares state against literals of the old type; ALTER COLUMN TYPE cannot rebuild
-- that expression itself, so it has to be dropped and recreated around the type swap.
DROP INDEX uq_credit_registrations_person_module;

ALTER TYPE credit_registration_state
RENAME TO credit_registration_state_old;

CREATE TYPE credit_registration_state AS ENUM (
  'pending_prerequisites',
  'pending_consent',
  'pending_student_number',
  'ready_to_submit',
  'checking_enrolment',
  'no_usable_enrolment',
  'submitting',
  'submission_uncertain',
  'awaiting_verification',
  'registered',
  'duplicate',
  'not_improved',
  'misregistered',
  'failed_retryable',
  'failed_permanent',
  'blocked',
  'cancelled',
  'abandoned_by_consent_withdrawal'
);

ALTER TABLE credit_registrations
ALTER COLUMN state TYPE credit_registration_state USING state::text::credit_registration_state;

ALTER TABLE credit_registrations
ALTER COLUMN state
SET DEFAULT 'pending_prerequisites';

ALTER TABLE credit_registration_events
ALTER COLUMN from_state TYPE credit_registration_state USING from_state::text::credit_registration_state,
ALTER COLUMN to_state TYPE credit_registration_state USING to_state::text::credit_registration_state;

ALTER TABLE credit_registration_admin_actions
ALTER COLUMN before_state TYPE credit_registration_state USING before_state::text::credit_registration_state,
ALTER COLUMN after_state TYPE credit_registration_state USING after_state::text::credit_registration_state;

ALTER TABLE credit_registration_daily_snapshots
ALTER COLUMN state TYPE credit_registration_state USING state::text::credit_registration_state;

DROP TYPE credit_registration_state_old;

CREATE UNIQUE INDEX uq_credit_registrations_person_module ON credit_registrations (sisu_person_id, course_module_id)
WHERE sisu_person_id IS NOT NULL
  AND deleted_at IS NULL
  AND superseded_by_id IS NULL
  AND state IN (
    'submitting',
    'submission_uncertain',
    'awaiting_verification',
    'registered',
    'duplicate',
    'not_improved'
  );

COMMENT ON TYPE credit_registration_state IS 'Lifecycle state of one credit registration. The success set for reporting and for the double-registration guard is exactly {registered, duplicate, not_improved}. abandoned_by_consent_withdrawal is in neither the success nor the failure set: the Sisu-side outcome is permanently unknown to us, so every count, alert and stuck query must exclude it.';
