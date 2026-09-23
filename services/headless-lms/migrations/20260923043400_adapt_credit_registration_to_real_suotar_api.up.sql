DROP TABLE open_university_product_access_tokens;
DROP TABLE course_module_suotar_realisations;

DELETE FROM credit_registration_phase_state
WHERE phase = 'product-token-refresh';

ALTER TABLE course_module_suotar_configurations
DROP CONSTRAINT course_module_suotar_configurations_check_result,
  DROP COLUMN open_university_product_id,
  DROP COLUMN product_token_found;
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
  ADD CONSTRAINT credit_registrations_reimport_count_nonnegative CHECK (not_registered_reimport_count >= 0);

COMMENT ON COLUMN credit_registrations.partially_registered_at IS 'When verify first saw only an assessment item attainment for the submission, with the course unit attainment still missing. Cleared on resubmission.';
COMMENT ON COLUMN credit_registrations.not_registered_reimport_count IS 'How many times Suotar answered notRegistered for a submission of this row and it was sent back to import.';
COMMENT ON COLUMN credit_registrations.selected_enrolment_realisation_name IS 'Localized name ({fi, sv, en}, each optional) of the course unit realisation the chosen enrolment belongs to, as Suotar reported it.';

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
  ADD COLUMN last_no_address_count INT,
  ADD COLUMN last_fast_tracked_count INT,
  ADD COLUMN last_fast_track_skipped_no_account_count INT,
  ADD COLUMN last_fast_track_skipped_unverified_count INT,
  ADD COLUMN last_fast_track_skipped_stale_verification_count INT,
  ADD COLUMN last_fast_track_skipped_name_mismatch_count INT,
  ADD COLUMN last_fast_track_skipped_account_has_number_count INT,
  ADD COLUMN last_fast_track_skipped_unlinked_before_count INT;

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
COMMENT ON COLUMN course_module_suotar_configurations.last_fast_tracked_count IS 'Of the last listing, how many persons were linked without a mail because the study registry holds a verified account address for them.';
COMMENT ON COLUMN course_module_suotar_configurations.last_fast_track_skipped_no_account_count IS 'Of the last listing, how many primary addresses matched no live account here. The ordinary linking mail covers these, and this is the bucket the whole linking flow exists for.';
COMMENT ON COLUMN course_module_suotar_configurations.last_fast_track_skipped_unverified_count IS 'Of the last listing, how many primary addresses matched an account that has never proved control of it. This is the population an email-verification campaign would convert into fast tracks.';
COMMENT ON COLUMN course_module_suotar_configurations.last_fast_track_skipped_stale_verification_count IS 'Of the last listing, how many matched accounts had a proof older than the configured recency bound.';
COMMENT ON COLUMN course_module_suotar_configurations.last_fast_track_skipped_name_mismatch_count IS 'Of the last listing, how many matched accounts carried a name unlike the one the study registry holds. A rise here is the observable signature of a university address reissued to a different person.';
COMMENT ON COLUMN course_module_suotar_configurations.last_fast_track_skipped_account_has_number_count IS 'Of the last listing, how many matched accounts already held a different student number. Replacing one silently is worse than mailing the link, whose confirmation screen names both numbers.';
COMMENT ON COLUMN course_module_suotar_configurations.last_fast_track_skipped_unlinked_before_count IS 'Of the last listing, how many matched accounts had already unlinked an automatic link for this person. Relinking them would make the unlink button theatre.';
