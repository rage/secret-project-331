-- The row spends a resolve-enrolments round trip in this state rather than checking_enrolment, so
-- import's claim query (which reads checking_enrolment) cannot pick it up before its enrolment is
-- actually resolved and its payload frozen.
ALTER TYPE credit_registration_state
ADD VALUE 'resolving_enrolment' AFTER 'ready_to_submit';

-- The unique index below cannot be created while duplicate push-registrar rows exist.
UPDATE course_module_completion_registered_to_study_registries t
SET deleted_at = now()
FROM (
    SELECT id,
      ROW_NUMBER() OVER (
        PARTITION BY course_module_completion_id
        ORDER BY created_at, id
      ) AS row_num
    FROM course_module_completion_registered_to_study_registries
    WHERE deleted_at IS NULL
      AND study_registry_registrar_id = '9da5a12f-0b96-4c35-a4fe-6d427d9c4292'
  ) AS dup
WHERE t.id = dup.id
  AND dup.row_num <> 1;

-- The registrar id must match SUOTAR_PUSH_REGISTRAR_ID in legacy_mirror.rs.
CREATE UNIQUE INDEX study_registry_push_mirror_completion_uniq_idx ON course_module_completion_registered_to_study_registries (course_module_completion_id)
WHERE deleted_at IS NULL
  AND study_registry_registrar_id = '9da5a12f-0b96-4c35-a4fe-6d427d9c4292';

ALTER TABLE course_module_suotar_realisations
ADD COLUMN last_listing_attempted_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_listing_error credit_registration_error_code,
  ADD COLUMN consecutive_listing_failures INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN course_module_suotar_realisations.last_listing_attempted_at IS 'When enrolment discovery last tried to list this realisation, whether or not the roster arrived. Orders the listing queue, so a realisation that keeps failing cannot starve the rest.';
COMMENT ON COLUMN course_module_suotar_realisations.last_listing_error IS 'Why the last listing attempt failed, null once one succeeds. What separates a failed listing from an empty course: the last_* counters keep describing the last roster that did arrive.';
COMMENT ON COLUMN course_module_suotar_realisations.consecutive_listing_failures IS 'Failed listing attempts since the last successful one.';

-- Single definition of "hard send failure", shared by get_send_status_totals_since,
-- get_send_failure_domains_since and count_send_failed_for_course in
-- credit_registration_account_linking_emails.rs, so the three cannot drift apart.
CREATE FUNCTION credit_registration_link_mail_is_hard_failure(
    retryable BOOLEAN,
    first_failed_at TIMESTAMP WITH TIME ZONE,
    retry_window_expired_before TIMESTAMP WITH TIME ZONE
  ) RETURNS BOOLEAN LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
SELECT NOT retryable
  OR (
    first_failed_at IS NOT NULL
    AND first_failed_at < retry_window_expired_before
  )
$$;
