ALTER TABLE course_module_suotar_configurations DROP COLUMN last_listing_attempted_at,
  DROP COLUMN last_listed_at,
  DROP COLUMN last_listing_error,
  DROP COLUMN consecutive_listing_failures,
  DROP COLUMN last_listed_person_count,
  DROP COLUMN last_already_linked_count,
  DROP COLUMN last_mailed_count,
  DROP COLUMN last_suppressed_by_dedup_count,
  DROP COLUMN last_suppressed_by_rate_cap_count,
  DROP COLUMN last_no_address_count,
  DROP COLUMN last_fast_tracked_count,
  DROP COLUMN last_fast_track_skipped_no_account_count,
  DROP COLUMN last_fast_track_skipped_unverified_count,
  DROP COLUMN last_fast_track_skipped_stale_verification_count,
  DROP COLUMN last_fast_track_skipped_name_mismatch_count,
  DROP COLUMN last_fast_track_skipped_account_has_number_count,
  DROP COLUMN last_fast_track_skipped_unlinked_before_count;

ALTER TABLE credit_registrations DROP CONSTRAINT credit_registrations_reimport_count_nonnegative,
  DROP COLUMN partially_registered_at,
  DROP COLUMN not_registered_reimport_count,
  DROP COLUMN selected_enrolment_realisation_name;

CREATE UNIQUE INDEX uq_credit_registrations_submitted_attainment ON credit_registrations (submitted_attainment_id)
WHERE submitted_attainment_id IS NOT NULL
  AND deleted_at IS NULL;

DROP INDEX idx_suotar_api_calls_request_item_ids;
ALTER TABLE suotar_api_calls DROP COLUMN request_item_ids;
DROP INDEX idx_credit_registration_events_request_item_id;
ALTER TABLE credit_registration_events DROP COLUMN request_item_id;

ALTER TABLE credit_registrations
ADD COLUMN request_item_id VARCHAR(128);
UPDATE credit_registrations
SET request_item_id = 'cr-' || id;
ALTER TABLE credit_registrations
ALTER COLUMN request_item_id
SET NOT NULL;
CREATE UNIQUE INDEX uq_credit_registrations_request_item_id ON credit_registrations (request_item_id);

DELETE FROM suotar_api_calls
WHERE endpoint = 'validate_course_codes';
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
ALTER COLUMN error_code TYPE credit_registration_error_code USING (
    CASE
      error_code::text
      WHEN 'service_temporarily_unavailable' THEN 'sisu_temporarily_unavailable'
      WHEN 'grade_scale_mismatch' THEN 'unknown'
      WHEN 'not_registered' THEN 'unknown'
      ELSE error_code::text
    END
  )::credit_registration_error_code;
ALTER TABLE credit_registration_events
ALTER COLUMN error_code TYPE credit_registration_error_code USING (
    CASE
      error_code::text
      WHEN 'service_temporarily_unavailable' THEN 'sisu_temporarily_unavailable'
      WHEN 'grade_scale_mismatch' THEN 'unknown'
      WHEN 'not_registered' THEN 'unknown'
      ELSE error_code::text
    END
  )::credit_registration_error_code;
DROP TYPE credit_registration_error_code_new;

ALTER TABLE course_module_suotar_configurations DROP CONSTRAINT course_module_suotar_configurations_check_result,
  ADD COLUMN open_university_product_id VARCHAR(255),
  ADD COLUMN product_token_found BOOLEAN;
ALTER TABLE course_module_suotar_configurations
ADD CONSTRAINT course_module_suotar_configurations_check_result CHECK (
    (config_checked_at IS NULL) = (
      course_code_resolves IS NULL
      AND product_token_found IS NULL
    )
  ) NOT VALID;

INSERT INTO credit_registration_phase_state (phase, process_name, expected_interval_secs)
VALUES ('product-token-refresh', 'suotar-syncer', 21600);

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
