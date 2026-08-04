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
