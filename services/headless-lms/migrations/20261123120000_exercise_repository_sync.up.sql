ALTER TABLE exercise_repositories
ADD COLUMN branch VARCHAR(255),
  ADD COLUMN sync_requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  ADD COLUMN sync_started_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN sync_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN last_synced_at TIMESTAMP WITH TIME ZONE,
  ADD COLUMN last_sync_report JSONB;

COMMENT ON COLUMN exercise_repositories.status IS 'Pending while a sync is queued or running, success after the latest sync succeeded, failure once a sync has failed too many times in a row.';
COMMENT ON COLUMN exercise_repositories.branch IS 'The git branch to sync from. If null, the default branch of the remote is used.';
COMMENT ON COLUMN exercise_repositories.sync_requested_at IS 'When a sync was last asked for. A sync that started before this time is followed by another one.';
COMMENT ON COLUMN exercise_repositories.sync_started_at IS 'When the sync worker started the running sync, or null when none is running. A sync running for too long is assumed dead and started again.';
COMMENT ON COLUMN exercise_repositories.sync_attempts IS 'Syncs started since the last request or success, the running one included. The repository is marked failed once a sync fails or dies at the worker''s limit.';
COMMENT ON COLUMN exercise_repositories.last_synced_at IS 'When the latest successful sync finished.';
COMMENT ON COLUMN exercise_repositories.last_sync_report IS 'What the latest successful sync changed, shown to teachers: exercises added, updated, renamed and removed, and exercise tasks refreshed or failed.';

ALTER TABLE repository_exercises
ADD COLUMN archive_path TEXT,
  ALTER COLUMN download_url TYPE TEXT;
UPDATE repository_exercises
SET archive_path = 'repository_exercises/' || repository_id || '/' || id;
ALTER TABLE repository_exercises
ALTER COLUMN archive_path
SET NOT NULL;

COMMENT ON COLUMN repository_exercises.archive_path IS 'File store path of the exercise''s archive. Each version gets a new path, so tasks still pointing at the previous version keep working until they are refreshed. Copies of a course share their source''s archives.';
COMMENT ON COLUMN repository_exercises.download_url IS 'The URL of the archive at archive_path.';

CREATE TABLE retired_repository_exercise_archives (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  repository_id UUID NOT NULL REFERENCES exercise_repositories(id),
  archive_path TEXT NOT NULL,
  download_url TEXT NOT NULL
);

CREATE INDEX idx_retired_repository_exercise_archives_repository_id ON retired_repository_exercise_archives (repository_id)
WHERE deleted_at IS NULL;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON retired_repository_exercise_archives FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE retired_repository_exercise_archives IS 'Repository exercise archives replaced by a sync or left behind by a removed exercise or repository. The object is removed from the file store once no repository exercise and no exercise task refers to it any more.';
COMMENT ON COLUMN retired_repository_exercise_archives.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN retired_repository_exercise_archives.created_at IS 'Timestamp when the archive was retired.';
COMMENT ON COLUMN retired_repository_exercise_archives.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN retired_repository_exercise_archives.deleted_at IS 'Timestamp when the archive was removed from the file store. If null, it is still stored.';
COMMENT ON COLUMN retired_repository_exercise_archives.repository_id IS 'The repository whose sync or deletion retired the archive.';
COMMENT ON COLUMN retired_repository_exercise_archives.archive_path IS 'File store path of the archive.';
COMMENT ON COLUMN retired_repository_exercise_archives.download_url IS 'The URL exercise task private specs embed for the archive.';

CREATE INDEX idx_exercise_tasks_repository_exercise_id ON exercise_tasks ((private_spec -> 'repository_exercise' ->> 'id'))
WHERE (private_spec -> 'repository_exercise' ->> 'id') IS NOT NULL;
CREATE INDEX idx_exercise_tasks_repository_exercise_download_url ON exercise_tasks (
  (private_spec -> 'repository_exercise' ->> 'download_url')
)
WHERE (private_spec -> 'repository_exercise' ->> 'download_url') IS NOT NULL;
