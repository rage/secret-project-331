DROP TABLE open_university_product_access_tokens;
DROP TABLE course_module_suotar_realisations;

DELETE FROM credit_registration_phase_state
WHERE phase = 'product-token-refresh';

ALTER TABLE course_module_suotar_configurations
DROP CONSTRAINT course_module_suotar_configurations_check_result,
  DROP COLUMN open_university_product_id,
  DROP COLUMN product_token_found,
  DROP COLUMN grade_scale_id;
ALTER TABLE course_module_suotar_configurations
  RENAME COLUMN course_code_resolves TO course_code_allowed;

-- A checked row may still carry no verdict: the check can run without Suotar answering for the code.
ALTER TABLE course_module_suotar_configurations
ADD CONSTRAINT course_module_suotar_configurations_check_result CHECK (
    config_checked_at IS NOT NULL
    OR course_code_allowed IS NULL
  );

COMMENT ON COLUMN course_module_suotar_configurations.config_checked_at IS 'When the config-validation phase last checked this module. NULL means never checked, so the admin view can show unknown instead of implying a passing check it never ran.';
COMMENT ON COLUMN course_module_suotar_configurations.course_code_allowed IS 'Whether Suotar accepted the module''s course code at the last config check. NULL means not checked, or checked without Suotar giving a verdict.';

ALTER TABLE course_module_suotar_configurations
ADD COLUMN checked_course_code VARCHAR(255),
  ADD COLUMN course_code_rejection TEXT;

COMMENT ON COLUMN course_module_suotar_configurations.checked_course_code IS 'The course code course_code_allowed is a verdict on. Once the module''s uh_course_code changes, the verdict no longer applies.';
COMMENT ON COLUMN course_module_suotar_configurations.course_code_rejection IS 'Suotar''s own reason for not accepting checked_course_code, quoted to operators. NULL unless course_code_allowed is false.';

CREATE OR REPLACE VIEW credit_registration_preconditions AS
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
  ) AS frozen_identity_stale,
  NOT EXISTS (
    SELECT 1
    FROM course_module_suotar_configurations conf
    WHERE conf.course_module_id = cr.course_module_id
      AND conf.deleted_at IS NULL
      AND NOT conf.course_code_allowed
      AND conf.checked_course_code = TRIM(cm.uh_course_code)
  ) AS course_code_allowed
FROM credit_registrations cr
  JOIN course_module_completions cmc ON cmc.id = cr.course_module_completion_id
  JOIN course_modules cm ON cm.id = cr.course_module_id
  LEFT JOIN verified_student_numbers vsn ON vsn.user_id = cr.user_id
  AND vsn.deleted_at IS NULL;

COMMENT ON COLUMN credit_registration_preconditions.course_code_allowed IS 'False while Suotar''s last verdict on the module''s current course code says it does not accept it; true once it does, or when there is no verdict. Rows wait in pending while false, since every import would come back courseNotAllowed.';

ALTER TYPE credit_registration_error_code
RENAME TO credit_registration_error_code_old;

CREATE TYPE credit_registration_error_code AS ENUM (
  'person_not_found',
  'course_code_not_found',
  'enrolment_not_found',
  'enrolment_not_accepted',
  'invalid_grade_for_grade_scale',
  'grade_scale_mismatch',
  'course_not_allowed',
  'invalid_credits',
  'study_right_not_valid',
  'sisu_validation_failed',
  'sisu_timeout',
  'service_temporarily_unavailable',
  'misregistered',
  'not_registered',
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
ALTER COLUMN error_code TYPE credit_registration_error_code USING (
    CASE
      error_code::text
      WHEN 'sisu_temporarily_unavailable' THEN 'service_temporarily_unavailable'
      WHEN 'acceptor_not_found' THEN 'unknown'
      ELSE error_code::text
    END
  )::credit_registration_error_code;

ALTER TABLE credit_registration_events
ALTER COLUMN error_code TYPE credit_registration_error_code USING (
    CASE
      error_code::text
      WHEN 'sisu_temporarily_unavailable' THEN 'service_temporarily_unavailable'
      WHEN 'acceptor_not_found' THEN 'unknown'
      ELSE error_code::text
    END
  )::credit_registration_error_code;

DROP TYPE credit_registration_error_code_old;

COMMENT ON TYPE credit_registration_error_code IS 'Why a credit registration is where it is. The values up to not_registered are Suotar moocfi per-item codes in snake_case; the rest are ours. service_temporarily_unavailable, not_registered and transport_error normally sit on failed_retryable, everything else on failed_permanent.';

DELETE FROM suotar_api_calls
WHERE endpoint = 'product_access_tokens';

ALTER TYPE suotar_endpoint
RENAME TO suotar_endpoint_old;

CREATE TYPE suotar_endpoint AS ENUM (
  'resolve_persons',
  'resolve_enrolments',
  'import_attainments',
  'verify_attainments',
  'list_by_course',
  'validate_course_codes'
);

ALTER TABLE suotar_api_calls
ALTER COLUMN endpoint TYPE suotar_endpoint USING endpoint::text::suotar_endpoint;

DROP TYPE suotar_endpoint_old;

COMMENT ON TYPE suotar_endpoint IS 'Which Suotar endpoint an API call row is about.';

DROP INDEX uq_credit_registrations_request_item_id;

ALTER TABLE credit_registrations DROP COLUMN request_item_id;

ALTER TABLE credit_registration_events
ADD COLUMN request_item_id VARCHAR(255);

CREATE INDEX idx_credit_registration_events_request_item_id ON credit_registration_events (request_item_id)
WHERE request_item_id IS NOT NULL;

COMMENT ON COLUMN credit_registration_events.request_item_id IS 'The requestItemId this row went out under in the Suotar call behind the event. A fresh UUID per call, so this and suotar_api_calls.request_item_ids are the only way to find the row in either side''s log.';

ALTER TABLE suotar_api_calls
ADD COLUMN request_item_ids TEXT [] NOT NULL DEFAULT '{}';

CREATE INDEX idx_suotar_api_calls_request_item_ids ON suotar_api_calls USING GIN (request_item_ids);

COMMENT ON COLUMN suotar_api_calls.request_item_ids IS 'Every requestItemId the call sent, in request order. Joins to credit_registration_events.request_item_id.';

-- duplicateRequestItem hands a later row of the same batch the submitted attainment of an earlier one.
DROP INDEX uq_credit_registrations_submitted_attainment;

ALTER TABLE credit_registrations
ADD COLUMN partially_registered_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN not_registered_reimport_count INT NOT NULL DEFAULT 0,
  ADD COLUMN selected_enrolment_realisation_name JSONB,
  ADD COLUMN resubmit_not_before TIMESTAMP WITH TIME ZONE,
  ADD CONSTRAINT credit_registrations_reimport_count_nonnegative CHECK (not_registered_reimport_count >= 0);

COMMENT ON COLUMN credit_registrations.partially_registered_at IS 'When verify first saw only an assessment item attainment for the submission, with the course unit attainment still missing. Cleared on resubmission.';
COMMENT ON COLUMN credit_registrations.not_registered_reimport_count IS 'How many times Suotar answered notRegistered for a submission of this row and it was sent back to import.';
COMMENT ON COLUMN credit_registrations.selected_enrolment_realisation_name IS 'Localized name ({fi, sv, en}, each optional) of the course unit realisation the chosen enrolment belongs to, as Suotar reported it.';
COMMENT ON COLUMN credit_registrations.resubmit_not_before IS 'The retryAfter of Suotar''s last submissionPending answer: until then Suotar may still turn the pending submission into an attainment, so a second import could register the credits twice. Cleared when Suotar answers notRegistered.';

ALTER TABLE course_module_suotar_configurations
ADD COLUMN last_listing_attempted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_listed_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_listing_error credit_registration_error_code,
  ADD COLUMN consecutive_listing_failures INT NOT NULL DEFAULT 0,
  ADD COLUMN last_listed_person_count INT,
  ADD COLUMN last_already_linked_count INT,
  ADD COLUMN last_mailed_count INT,
  ADD COLUMN last_suppressed_by_dedup_count INT,
  ADD COLUMN last_suppressed_by_rate_cap_count INT,
  ADD COLUMN last_no_address_count INT;

COMMENT ON COLUMN course_module_suotar_configurations.last_listing_attempted_at IS 'When enrolment discovery last tried to list this module''s course code, whether or not the roster arrived. Orders the listing queue, so a module that keeps failing cannot starve the rest.';
COMMENT ON COLUMN course_module_suotar_configurations.last_listed_at IS 'When enrolment discovery last listed this module''s course code successfully.';
COMMENT ON COLUMN course_module_suotar_configurations.last_listing_error IS 'Why the last listing attempt failed, null once one succeeds. What separates a failed listing from an empty course: the last_* counters keep describing the last roster that did arrive.';
COMMENT ON COLUMN course_module_suotar_configurations.consecutive_listing_failures IS 'Failed listing attempts since the last successful one.';
COMMENT ON COLUMN course_module_suotar_configurations.last_listed_person_count IS 'How many persons the last listing returned.';
COMMENT ON COLUMN course_module_suotar_configurations.last_already_linked_count IS 'Of the last listing, how many persons already had a linked account.';
COMMENT ON COLUMN course_module_suotar_configurations.last_mailed_count IS 'Of the last listing, how many linking mails were queued.';
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_dedup_count IS 'Of the last listing, how many mails were suppressed because we had already mailed that person and address for this course.';
COMMENT ON COLUMN course_module_suotar_configurations.last_suppressed_by_rate_cap_count IS 'Of the last listing, how many mails were suppressed by a per-person rate cap.';
COMMENT ON COLUMN course_module_suotar_configurations.last_no_address_count IS 'Of the last listing, how many persons had no usable address to mail.';

ALTER TABLE course_modules DROP CONSTRAINT course_modules_one_credit_registration_path;

COMMENT ON COLUMN course_modules.enable_credit_registration_via_suotar IS 'Whether the module takes part in credit registration via Suotar: the pipeline runs for it and its configuration is checked. It does not move completions onto that path by itself; only completions with register_credits_via_suotar set go there, and the rest stay with enable_registering_completion_to_uh_open_university, which may be on at the same time.';

ALTER TABLE course_modules
ADD COLUMN register_eligible_new_completions_via_suotar BOOLEAN NOT NULL DEFAULT FALSE,
  ADD CONSTRAINT course_modules_register_new_completions_requires_suotar CHECK (
    NOT register_eligible_new_completions_via_suotar
    OR enable_credit_registration_via_suotar
  );

COMMENT ON COLUMN course_modules.register_eligible_new_completions_via_suotar IS 'While on, a completion created for this module gets register_credits_via_suotar set if its student then holds a live verified_student_numbers row. Checked once at creation: completions made before it was turned on are not swept in, and a student linked later is not re-checked. Set by hand only:
UPDATE course_modules
SET register_eligible_new_completions_via_suotar = TRUE
WHERE id = :course_module_id
  AND enable_credit_registration_via_suotar
  AND deleted_at IS NULL;
Turning it off again affects only completions created afterwards.';

CREATE TYPE student_number_verification_method_new AS ENUM (
  'emailed_link',
  'admin_manual',
  'study_registry'
);

-- The new type cannot say how these were proven; their students relink through the mailed link.
DELETE FROM verified_student_numbers
WHERE verified_via = 'email_match_fast_track';

ALTER TABLE verified_student_numbers DROP CONSTRAINT verified_student_numbers_proof_address,
  DROP CONSTRAINT verified_student_numbers_match_field_method,
  DROP CONSTRAINT verified_student_numbers_admin_linker,
  DROP CONSTRAINT verified_student_numbers_link_reason,
  DROP COLUMN verified_via_email_match_field,
  DROP COLUMN account_email_verified_at,
  DROP COLUMN auto_link_notice_dismissed_at,
  ALTER COLUMN verified_via DROP DEFAULT;

ALTER TABLE verified_student_numbers
ALTER COLUMN verified_via TYPE student_number_verification_method_new USING verified_via::text::student_number_verification_method_new;

DROP TYPE student_number_verification_method;

ALTER TYPE student_number_verification_method_new
RENAME TO student_number_verification_method;

ALTER TABLE verified_student_numbers
ALTER COLUMN verified_via
SET DEFAULT 'emailed_link',
  ALTER COLUMN sisu_person_id DROP NOT NULL,
  ADD CONSTRAINT verified_student_numbers_proof_address CHECK (
    (verified_via IN ('admin_manual', 'study_registry')) = (verified_via_email IS NULL)
  ),
  ADD CONSTRAINT verified_student_numbers_admin_linker CHECK (
    (verified_via = 'admin_manual') = (linked_by_user_id IS NOT NULL)
  ),
  ADD CONSTRAINT verified_student_numbers_link_reason CHECK (
    verified_via = 'admin_manual'
    OR link_reason IS NULL
  ),
  ADD CONSTRAINT verified_student_numbers_person_id CHECK (
    verified_via = 'study_registry'
    OR sisu_person_id IS NOT NULL
  );

COMMENT ON TYPE student_number_verification_method IS 'How a student number was proven to belong to an account. A discriminator, not a flag: reads that care about strength of proof must match exhaustively. study_registry means a registrar reported registering one of the account''s completions under the number.';
COMMENT ON COLUMN verified_student_numbers.verified_via_email IS 'The Sisu-held address the linking mail was sent to. NULL exactly for admin_manual and study_registry rows.';
COMMENT ON COLUMN verified_student_numbers.sisu_person_id IS 'Sisu person id reported alongside the student number. Stable across student number changes, live-unique, and the identity the double-registration guards key on. NULL only for study_registry rows, whose registrar reports a number and no person; nothing we send to Suotar needs it.';

CREATE INDEX idx_cmc_registered_to_study_registries_registrar_user ON course_module_completion_registered_to_study_registries (user_id, created_at DESC)
WHERE deleted_at IS NULL
  AND study_registry_registrar_id IS NOT NULL;

CREATE VIEW study_registry_reported_student_numbers AS
SELECT DISTINCT ON (r.user_id) r.id AS registered_completion_id,
  r.user_id,
  REGEXP_REPLACE(r.real_student_number, '\s', '', 'g') AS student_number
FROM course_module_completion_registered_to_study_registries r
WHERE r.deleted_at IS NULL
  AND r.study_registry_registrar_id IS NOT NULL
ORDER BY r.user_id,
  r.created_at DESC,
  r.id DESC;

COMMENT ON VIEW study_registry_reported_student_numbers IS 'Per account, the student number a third-party registrar most recently reported registering one of its completions under, whitespace stripped. Our own mirrored rows are left out: their number came from verified_student_numbers in the first place.';

CREATE TABLE study_registry_student_number_conflicts (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  student_number VARCHAR(32) NOT NULL,
  registered_completion_id UUID NOT NULL REFERENCES course_module_completion_registered_to_study_registries(id),
  conflicting_verified_student_number_id UUID NOT NULL REFERENCES verified_student_numbers(id)
);

CREATE UNIQUE INDEX uq_study_registry_student_number_conflicts ON study_registry_student_number_conflicts (user_id, student_number)
WHERE deleted_at IS NULL;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON study_registry_student_number_conflicts FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE study_registry_student_number_conflicts IS 'Student numbers a registrar reported for an account that could not become its study_registry link because a live link already stood in the way. The existing link is kept; a row stops mattering once the account holds the reported number.';
COMMENT ON COLUMN study_registry_student_number_conflicts.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN study_registry_student_number_conflicts.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN study_registry_student_number_conflicts.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN study_registry_student_number_conflicts.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN study_registry_student_number_conflicts.user_id IS 'The account whose completion the registrar reported.';
COMMENT ON COLUMN study_registry_student_number_conflicts.student_number IS 'The number the registrar reported, whitespace stripped.';
COMMENT ON COLUMN study_registry_student_number_conflicts.registered_completion_id IS 'The registrar''s record the number came from.';
COMMENT ON COLUMN study_registry_student_number_conflicts.conflicting_verified_student_number_id IS 'The live link that stood in the way: the account''s own link to another number, or another account''s link to this number.';

INSERT INTO verified_student_numbers (user_id, student_number, verified_via)
SELECT DISTINCT ON (reported.student_number) reported.user_id,
  reported.student_number,
  'study_registry'
FROM study_registry_reported_student_numbers reported
WHERE reported.student_number ~ '^[0-9]{6,12}$'
  AND NOT EXISTS (
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.user_id = reported.user_id
      AND vsn.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.student_number = reported.student_number
      AND vsn.deleted_at IS NULL
  )
ORDER BY reported.student_number,
  reported.user_id;

INSERT INTO study_registry_student_number_conflicts (
    user_id,
    student_number,
    registered_completion_id,
    conflicting_verified_student_number_id
  )
SELECT reported.user_id,
  reported.student_number,
  reported.registered_completion_id,
  blocker.id
FROM study_registry_reported_student_numbers reported
  JOIN LATERAL (
    SELECT vsn.id
    FROM verified_student_numbers vsn
    WHERE vsn.deleted_at IS NULL
      AND (
        (
          vsn.user_id = reported.user_id
          AND vsn.student_number <> reported.student_number
        )
        OR (
          vsn.user_id <> reported.user_id
          AND vsn.student_number = reported.student_number
        )
      )
    ORDER BY vsn.user_id = reported.user_id DESC
    LIMIT 1
  ) blocker ON TRUE
WHERE reported.student_number ~ '^[0-9]{6,12}$';

COMMENT ON COLUMN course_module_completions.register_credits_via_suotar IS 'Whether this completion goes through the push path rather than being registered the old way. Set at creation only when the module has register_eligible_new_completions_via_suotar on and the student holds a live verified_student_numbers row; otherwise changed by hand only. Load-bearing in three places that must agree: credit_registration_eligible_completions admits only rows with this set, the pull path skips exactly those rows, and the student is shown the new registration page for them. A row with this false is registered the old way end to end.
Opt in, only while nothing else can register the completion:
UPDATE course_module_completions cmc
SET register_credits_via_suotar = TRUE
FROM course_modules cm
  JOIN course_module_suotar_configurations conf ON conf.course_module_id = cm.id
  AND conf.deleted_at IS NULL
WHERE cmc.id = :completion_id
  AND cm.id = cmc.course_module_id
  AND cm.enable_credit_registration_via_suotar
  AND cm.deleted_at IS NULL
  AND conf.course_code_allowed
  AND conf.checked_course_code = TRIM(cm.uh_course_code)
  AND cmc.deleted_at IS NULL
  AND EXISTS (
    SELECT 1
    FROM verified_student_numbers vsn
    WHERE vsn.user_id = cmc.user_id
      AND vsn.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM course_module_completion_registered_to_study_registries r
    WHERE r.course_module_completion_id = cmc.id
      AND r.deleted_at IS NULL
  )
  AND NOT EXISTS (
    SELECT 1
    FROM credit_registrations cr
    WHERE cr.course_module_completion_id = cmc.id
      AND cr.deleted_at IS NULL
  );
Opt out, only until anything was submitted to Suotar; retires the unsent ledger row so the pull path offers the completion again. The final UPDATE repeats the submitted/state check per row, closing the window where import moves a row to submitting between the two statements:
WITH opted_out AS (
  UPDATE course_module_completions cmc
  SET register_credits_via_suotar = FALSE
  WHERE cmc.id = :completion_id
    AND cmc.register_credits_via_suotar
    AND NOT EXISTS (
      SELECT 1
      FROM credit_registrations cr
      WHERE cr.course_module_completion_id = cmc.id
        AND cr.deleted_at IS NULL
        AND (
          cr.submitted_at IS NOT NULL
          OR cr.state NOT IN (
            ''pending'',
            ''ready_to_submit'',
            ''resolving_enrolment'',
            ''checking_enrolment'',
            ''no_usable_enrolment'',
            ''failed_retryable'',
            ''failed_permanent'',
            ''blocked'',
            ''cancelled''
          )
        )
    )
  RETURNING cmc.id
)
UPDATE credit_registrations cr
SET deleted_at = now()
FROM opted_out
WHERE cr.course_module_completion_id = opted_out.id
  AND cr.deleted_at IS NULL
  AND cr.submitted_at IS NULL
  AND cr.state IN (
    ''pending'',
    ''ready_to_submit'',
    ''resolving_enrolment'',
    ''checking_enrolment'',
    ''no_usable_enrolment'',
    ''failed_retryable'',
    ''failed_permanent'',
    ''blocked'',
    ''cancelled''
  );';

-- Soft-deleted rather than relabelled: email_deliveries reference them. deleted_at differs per row
-- because unique_email_templates_type_language_general keys on it NULLS NOT DISTINCT.
UPDATE email_templates t
SET email_template_type = 'generic',
  deleted_at = now() - (r.n * INTERVAL '1 microsecond')
FROM (
    SELECT id,
      row_number() OVER (
        ORDER BY id
      ) AS n
    FROM email_templates
    WHERE email_template_type = 'credit_registration_student_number_linked'
  ) r
WHERE t.id = r.id;

ALTER TYPE email_template_type
RENAME TO email_template_type_old;

CREATE TYPE email_template_type AS ENUM (
  'reset_password_email',
  'delete_user_email',
  'generic',
  'confirm_email_code',
  'credit_registration_account_linking',
  'verify_email_address',
  'credit_registration_action_needed',
  'credit_registration_registered'
);

ALTER TABLE email_templates
ALTER COLUMN email_template_type TYPE email_template_type USING (
    email_template_type::text::email_template_type
  );

DROP TYPE email_template_type_old;

COMMENT ON TYPE email_template_type IS 'Type of email template: generic templates do not support automated placeholder replacements, others do.';
