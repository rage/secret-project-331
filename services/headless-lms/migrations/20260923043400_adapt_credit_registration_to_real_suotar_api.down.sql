-- Every lock is held until commit; fail fast rather than queue every reader of a hot table behind us.
-- Statements that lock course_modules, course_module_completions, users or the legacy registration
-- table are last.
SET LOCAL lock_timeout = '5s';

ALTER TYPE email_template_type
ADD VALUE 'credit_registration_student_number_linked';

-- Frees the study_registry links deleted below; the table itself is dropped at the end.
DELETE FROM study_registry_student_number_conflicts;

DROP VIEW study_registry_reported_student_numbers;

-- The old schema can hold neither the method nor a link without a person id.
DELETE FROM verified_student_numbers
WHERE verified_via = 'study_registry';

CREATE TYPE student_number_verification_method_old AS ENUM (
  'emailed_link',
  'email_match_fast_track',
  'admin_manual'
);
ALTER TABLE verified_student_numbers DROP CONSTRAINT verified_student_numbers_proof_address,
  DROP CONSTRAINT verified_student_numbers_admin_linker,
  DROP CONSTRAINT verified_student_numbers_link_reason,
  DROP CONSTRAINT verified_student_numbers_person_id,
  ADD COLUMN verified_via_email_match_field VARCHAR(16),
  ADD COLUMN account_email_verified_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN auto_link_notice_dismissed_at TIMESTAMP WITH TIME ZONE,
  ALTER COLUMN verified_via DROP DEFAULT;
ALTER TABLE verified_student_numbers
ALTER COLUMN verified_via TYPE student_number_verification_method_old USING verified_via::text::student_number_verification_method_old;
DROP TYPE student_number_verification_method;
ALTER TYPE student_number_verification_method_old
RENAME TO student_number_verification_method;
ALTER TABLE verified_student_numbers
ALTER COLUMN verified_via
SET DEFAULT 'emailed_link',
  ALTER COLUMN sisu_person_id
SET NOT NULL,
  ADD CONSTRAINT verified_student_numbers_proof_address CHECK (
    (verified_via = 'admin_manual') = (verified_via_email IS NULL)
  ),
  ADD CONSTRAINT verified_student_numbers_match_field_method CHECK (
    verified_via = 'email_match_fast_track'
    OR verified_via_email_match_field IS NULL
  ),
  ADD CONSTRAINT verified_student_numbers_admin_linker CHECK (
    (verified_via = 'admin_manual') = (linked_by_user_id IS NOT NULL)
  ),
  ADD CONSTRAINT verified_student_numbers_link_reason CHECK (
    verified_via = 'admin_manual'
    OR link_reason IS NULL
  );
COMMENT ON TYPE student_number_verification_method IS 'How a student number was proven to belong to an account. A discriminator, not a flag: reads that care about strength of proof must match exhaustively.';
COMMENT ON COLUMN verified_student_numbers.verified_via_email IS 'The Sisu-held address the proof rests on: the address the link was mailed to, or the matched address for the fast track. NULL exactly for admin_manual rows.';
COMMENT ON COLUMN verified_student_numbers.sisu_person_id IS 'Sisu person id reported alongside the student number. Stable across student number changes, live-unique, and the identity the double-registration guards key on.';
COMMENT ON COLUMN verified_student_numbers.verified_via_email_match_field IS 'Which Sisu address field matched for email_match_fast_track rows: primary (secondary is reserved and not currently accepted). NULL for other methods.';
COMMENT ON COLUMN verified_student_numbers.account_email_verified_at IS 'The account email verification timestamp as it stood at link time, frozen here on purpose: user_details.email_verified_at is cleared on the next address change, and an audit years later must still be able to answer how old the proof was.';
COMMENT ON COLUMN verified_student_numbers.auto_link_notice_dismissed_at IS 'When the student dismissed the notice telling them this link was made automatically. Only ever set for verified_via = email_match_fast_track; the notice and its one-click unlink are the compensating control for linking without asking.';

ALTER TABLE course_module_suotar_configurations DROP COLUMN last_listing_attempted_at,
  DROP COLUMN last_listed_at,
  DROP COLUMN last_listing_error,
  DROP COLUMN consecutive_listing_failures,
  DROP COLUMN last_listed_person_count,
  DROP COLUMN last_already_linked_count,
  DROP COLUMN last_mailed_count,
  DROP COLUMN last_suppressed_by_dedup_count,
  DROP COLUMN last_suppressed_by_rate_cap_count,
  DROP COLUMN last_no_address_count;

DROP INDEX uq_credit_registrations_completion;
CREATE UNIQUE INDEX uq_credit_registrations_completion ON credit_registrations (course_module_completion_id)
WHERE deleted_at IS NULL
  AND superseded_by_id IS NULL;

ALTER TABLE credit_registrations DROP COLUMN pending_superseded_by_id;

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

COMMENT ON COLUMN credit_registrations.superseded_by_id IS 'The newer attempt that replaced this row. Set when a strictly better grade is resubmitted; the old row keeps its state and terminal_at, because it really was registered.';

ALTER TABLE credit_registrations DROP CONSTRAINT credit_registrations_reimport_count_nonnegative,
  DROP COLUMN partially_registered_at,
  DROP COLUMN not_registered_reimport_count,
  DROP COLUMN selected_enrolment_realisation_name,
  DROP COLUMN resubmit_not_before,
  DROP COLUMN no_usable_enrolment_since;

CREATE UNIQUE INDEX uq_credit_registrations_submitted_attainment ON credit_registrations (submitted_attainment_id)
WHERE submitted_attainment_id IS NOT NULL
  AND deleted_at IS NULL;

DROP INDEX idx_suotar_api_calls_request_item_ids;
ALTER TABLE suotar_api_calls DROP COLUMN request_item_ids;
DROP INDEX idx_credit_registration_events_request_item_id;
ALTER TABLE credit_registration_events DROP COLUMN request_item_id;

-- NOT NULL because the code this reverts to reads it as a String.
ALTER TABLE credit_registrations
ADD COLUMN request_item_id VARCHAR(128);
UPDATE credit_registrations
SET request_item_id = 'cr-' || id;
ALTER TABLE credit_registrations
ALTER COLUMN request_item_id
SET NOT NULL;
CREATE UNIQUE INDEX uq_credit_registrations_request_item_id ON credit_registrations (request_item_id);

ALTER TYPE suotar_endpoint
RENAME TO suotar_endpoint_new;
CREATE TYPE suotar_endpoint AS ENUM (
  'resolve_persons',
  'resolve_enrolments',
  'import_attainments',
  'verify_attainments',
  'product_access_tokens',
  'list_by_course'
);
ALTER TABLE suotar_api_calls
ALTER COLUMN endpoint TYPE suotar_endpoint USING endpoint::text::suotar_endpoint;
DROP TYPE suotar_endpoint_new;

ALTER TYPE credit_registration_error_code
RENAME TO credit_registration_error_code_new;
CREATE TYPE credit_registration_error_code AS ENUM (
  'person_not_found',
  'course_code_not_found',
  'enrolment_not_found',
  'enrolment_not_accepted',
  'invalid_grade_for_grade_scale',
  'course_not_allowed',
  'invalid_credits',
  'study_right_not_valid',
  'acceptor_not_found',
  'sisu_validation_failed',
  'sisu_timeout',
  'sisu_temporarily_unavailable',
  'misregistered',
  'unauthorized',
  'malformed_request',
  'transport_error',
  'unexpected_response',
  'no_grade_scale_mapping',
  'missing_uh_course_code',
  'missing_ects_credits',
  'retry_window_expired',
  'unknown'
);
ALTER TABLE credit_registrations
ALTER COLUMN error_code TYPE credit_registration_error_code USING error_code::text::credit_registration_error_code;
ALTER TABLE credit_registration_events
ALTER COLUMN error_code TYPE credit_registration_error_code USING error_code::text::credit_registration_error_code;
DROP TYPE credit_registration_error_code_new;

DROP VIEW credit_registration_preconditions;
CREATE VIEW credit_registration_preconditions AS
SELECT cr.id AS credit_registration_id,
  cmc.deleted_at IS NOT NULL AS completion_deleted,
  cmc.deleted_at IS NULL
  AND cmc.passed
  AND cmc.eligible_for_ects
  AND cmc.prerequisite_modules_completed
  AND NOT cmc.needs_to_be_reviewed AS completion_eligible,
  vsn.id IS NOT NULL AS has_verified_student_number,
  cr.student_number IS NOT NULL
  AND (
    vsn.student_number IS DISTINCT FROM cr.student_number
    OR vsn.sisu_person_id IS DISTINCT FROM cr.sisu_person_id
  ) AS frozen_identity_stale
FROM credit_registrations cr
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL;
COMMENT ON VIEW credit_registration_preconditions IS 'The things one ledger row waits on, as they stand right now. The ledger records only that a row is pending, so this is where every surface that names the blocker, and the precondition recompute that acts on it, read the same answer.';
COMMENT ON COLUMN credit_registration_preconditions.frozen_identity_stale IS 'The account has relinked to a different verified student number since this row froze its payload for import. A relink soft-deletes and re-inserts in one transaction, so has_verified_student_number stays true throughout and catches none of it.';

ALTER TABLE course_module_suotar_configurations DROP COLUMN checked_course_code,
  DROP COLUMN course_code_rejection;

ALTER TABLE course_module_suotar_configurations
  RENAME COLUMN course_code_allowed TO course_code_resolves;
ALTER TABLE course_module_suotar_configurations DROP CONSTRAINT course_module_suotar_configurations_check_result,
  ADD COLUMN open_university_product_id VARCHAR(255),
  ADD COLUMN product_token_found BOOLEAN,
  ADD COLUMN grade_scale_id VARCHAR(64);
COMMENT ON COLUMN course_module_suotar_configurations.grade_scale_id IS 'Per-module override of the Sisu grade scale id. NULL means derive it from the completion.';
ALTER TABLE course_module_suotar_configurations
ADD CONSTRAINT course_module_suotar_configurations_check_result CHECK (
    (config_checked_at IS NULL) = (
      course_code_resolves IS NULL
      AND product_token_found IS NULL
    )
  );

INSERT INTO credit_registration_phase_state (phase, process_name, expected_interval_secs)
VALUES ('product-token-refresh', 'suotar-syncer', 21600);

CREATE TABLE open_university_product_access_tokens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  open_university_product_id VARCHAR(255) NOT NULL,
  access_token VARCHAR(255),
  state VARCHAR(64),
  document_state VARCHAR(64),
  suotar_token_id VARCHAR(255),
  last_refreshed_at TIMESTAMP WITH TIME ZONE,
  last_refresh_failed_at TIMESTAMP WITH TIME ZONE,
  last_refresh_error TEXT,
  consecutive_failures INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX uq_ou_product_access_tokens_product ON open_university_product_access_tokens (open_university_product_id, deleted_at) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON open_university_product_access_tokens FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

DROP TABLE study_registry_student_number_conflicts;
DROP INDEX idx_cmc_registered_to_study_registries_registrar_user;

ALTER TABLE course_modules DROP CONSTRAINT course_modules_register_new_completions_requires_suotar,
  DROP COLUMN register_eligible_new_completions_via_suotar;
-- The old schema keeps the two paths exclusive; the open university one is what most students use.
UPDATE course_modules
SET enable_credit_registration_via_suotar = FALSE
WHERE enable_credit_registration_via_suotar
  AND enable_registering_completion_to_uh_open_university;
ALTER TABLE course_modules
ADD CONSTRAINT course_modules_one_credit_registration_path CHECK (
    NOT (
      enable_credit_registration_via_suotar
      AND enable_registering_completion_to_uh_open_university
    )
  ) NOT VALID;
COMMENT ON COLUMN course_modules.enable_credit_registration_via_suotar IS 'The per-module opt-in for credit registration via Suotar, and the rollout switch. The course_modules_one_credit_registration_path constraint keeps it mutually exclusive with enable_registering_completion_to_uh_open_university, because both paths would register the same attainment in Sisu; while it is on, the legacy pull API must not see this modules completions.';

COMMENT ON COLUMN course_module_completions.register_credits_via_suotar IS 'Whether this completion goes through the push path rather than being registered the old way. Decided once, when the completion is created, from the module''s enable_credit_registration_via_suotar; never recomputed, so a module switched on or off mid-course leaves completions already made where they were. Load-bearing in three places that must agree: credit_registration_eligible_completions admits only rows with this set, the pull path skips exactly those rows, and the student is shown the new registration page for them. A row with this false is registered the old way end to end.';

CREATE TABLE course_module_suotar_realisations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_module_id UUID NOT NULL REFERENCES course_modules(id),
  course_unit_realisation_id VARCHAR(255) NOT NULL,
  label VARCHAR(255),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_listed_at TIMESTAMP WITH TIME ZONE,
  last_listed_person_count INT,
  last_already_linked_count INT,
  last_mailed_count INT,
  last_suppressed_by_dedup_count INT,
  last_suppressed_by_rate_cap_count INT,
  last_no_address_count INT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  last_listing_attempted_at TIMESTAMP WITH TIME ZONE,
  last_listing_error credit_registration_error_code,
  consecutive_listing_failures INT NOT NULL DEFAULT 0,
  last_fast_tracked_count INT,
  last_fast_track_skipped_no_account_count INT,
  last_fast_track_skipped_unverified_count INT,
  last_fast_track_skipped_stale_verification_count INT,
  last_fast_track_skipped_name_mismatch_count INT,
  last_fast_track_skipped_account_has_number_count INT,
  last_fast_track_skipped_unlinked_before_count INT
);
CREATE UNIQUE INDEX uq_course_module_suotar_realisations ON course_module_suotar_realisations (
  course_module_id,
  course_unit_realisation_id,
  deleted_at
) NULLS NOT DISTINCT;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_module_suotar_realisations FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
