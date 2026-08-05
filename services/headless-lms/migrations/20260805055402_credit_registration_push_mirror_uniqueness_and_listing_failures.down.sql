ALTER TABLE course_module_suotar_realisations DROP COLUMN consecutive_listing_failures,
  DROP COLUMN last_listing_error,
  DROP COLUMN last_listing_attempted_at;

DROP INDEX IF EXISTS study_registry_push_mirror_completion_uniq_idx;
