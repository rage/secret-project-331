DROP VIEW IF EXISTS credit_registration_active_course_modules;

DROP VIEW IF EXISTS credit_registration_preconditions;

DROP VIEW IF EXISTS credit_registration_registrable_completions;

DROP VIEW IF EXISTS credit_registration_eligible_completions;

DROP INDEX idx_credit_registrations_module_error_code;

DROP INDEX idx_suotar_api_calls_endpoint_successes;

ALTER TABLE credit_registrations DROP CONSTRAINT credit_registrations_attempt_counts_nonnegative,
  DROP CONSTRAINT credit_registrations_registered_at_set,
  DROP CONSTRAINT credit_registrations_superseded_by_not_self,
  DROP CONSTRAINT credit_registrations_superseded_pair;

ALTER TABLE credit_registrations
DROP CONSTRAINT credit_registrations_superseded_by_id_fkey;

ALTER TABLE credit_registrations
ADD CONSTRAINT credit_registrations_superseded_by_id_fkey FOREIGN KEY (superseded_by_id) REFERENCES credit_registrations(id);

DROP INDEX uq_credit_registrations_person_module;

DROP INDEX idx_credit_registrations_unnotified;

ALTER TABLE credit_registrations
ALTER COLUMN state DROP DEFAULT;

ALTER TYPE credit_registration_state
RENAME TO credit_registration_state_new;

CREATE TYPE credit_registration_state AS ENUM (
  'pending_prerequisites',
  'pending_consent',
  'pending_student_number',
  'ready_to_submit',
  'resolving_enrolment',
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

-- Lossy: which precondition a row was waiting on was not stored, so every pending row comes back as
-- the first of the three and the next precondition pass moves it on.
ALTER TABLE credit_registrations
ALTER COLUMN state TYPE credit_registration_state USING CASE
    WHEN state::text = 'pending' THEN 'pending_prerequisites'
    ELSE state::text
  END::credit_registration_state;

ALTER TABLE credit_registration_events
ALTER COLUMN from_state TYPE credit_registration_state USING CASE
    WHEN from_state::text = 'pending' THEN 'pending_prerequisites'
    ELSE from_state::text
  END::credit_registration_state,
  ALTER COLUMN to_state TYPE credit_registration_state USING CASE
    WHEN to_state::text = 'pending' THEN 'pending_prerequisites'
    ELSE to_state::text
  END::credit_registration_state;

ALTER TABLE credit_registration_admin_actions
ALTER COLUMN before_state TYPE credit_registration_state USING CASE
    WHEN before_state::text = 'pending' THEN 'pending_prerequisites'
    ELSE before_state::text
  END::credit_registration_state,
  ALTER COLUMN after_state TYPE credit_registration_state USING CASE
    WHEN after_state::text = 'pending' THEN 'pending_prerequisites'
    ELSE after_state::text
  END::credit_registration_state;

ALTER TABLE credit_registration_daily_snapshots
ALTER COLUMN state TYPE credit_registration_state USING CASE
    WHEN state::text = 'pending' THEN 'pending_prerequisites'
    ELSE state::text
  END::credit_registration_state;

DROP TYPE credit_registration_state_new;

ALTER TABLE credit_registrations
ALTER COLUMN state
SET DEFAULT 'pending_prerequisites';

COMMENT ON TYPE credit_registration_state IS 'Lifecycle state of one credit registration. The success set for reporting and for the double-registration guard is exactly {registered, duplicate, not_improved}. abandoned_by_consent_withdrawal is in neither the success nor the failure set: the Sisu-side outcome is permanently unknown to us, so every count, alert and stuck query must exclude it.';

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

CREATE INDEX idx_credit_registrations_unnotified ON credit_registrations (state_entered_at)
WHERE deleted_at IS NULL
  AND (
    (
      state = 'no_usable_enrolment'::credit_registration_state
      AND action_needed_email_delivery_id IS NULL
    )
    OR (
      state IN (
        'registered'::credit_registration_state,
        'duplicate'::credit_registration_state,
        'not_improved'::credit_registration_state
      )
      AND registered_email_delivery_id IS NULL
    )
  );
