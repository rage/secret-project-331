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
