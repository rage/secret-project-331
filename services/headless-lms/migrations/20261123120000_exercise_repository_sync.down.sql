DROP INDEX idx_exercise_tasks_repository_exercise_download_url;
DROP INDEX idx_exercise_tasks_repository_exercise_id;
DROP TABLE retired_repository_exercise_archives;
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
