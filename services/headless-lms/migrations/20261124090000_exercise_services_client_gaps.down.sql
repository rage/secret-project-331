DROP INDEX exercise_task_submissions_exercise_task_grading_id_idx;
DROP INDEX exercise_task_gradings_pending_updated_at_idx;
ALTER TABLE exercise_tasks DROP COLUMN repository_exercise_checksum,
  DROP COLUMN repository_exercise_id;
DROP TABLE retired_repository_exercise_archives;
ALTER TABLE exercise_service_info DROP COLUMN repository_preparation_endpoint_path;
ALTER TABLE repository_exercises DROP COLUMN details;
ALTER TABLE repository_exercises DROP COLUMN archive_path,
  ALTER COLUMN download_url TYPE VARCHAR(255);
COMMENT ON COLUMN repository_exercises.download_url IS NULL;
ALTER TABLE exercise_repositories DROP COLUMN branch,
  DROP COLUMN sync_requested_at,
  DROP COLUMN sync_started_at,
  DROP COLUMN sync_attempts,
  DROP COLUMN last_synced_at,
  DROP COLUMN last_sync_report;
COMMENT ON COLUMN exercise_repositories.status IS 'The status of the process for adding the repository.';
DROP TABLE course_model_solution_settings;
ALTER TABLE oauth_access_tokens DROP COLUMN refresh_token_family_id;
ALTER TABLE oauth_refresh_tokens DROP COLUMN family_id;
