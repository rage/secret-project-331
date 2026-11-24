ALTER TABLE oauth_refresh_tokens
ADD COLUMN family_id UUID;
-- Until now every (user, client) pair was one family.
UPDATE oauth_refresh_tokens AS t
SET family_id = f.family_id
FROM (
    SELECT user_id,
      client_id,
      uuid_generate_v4() AS family_id
    FROM oauth_refresh_tokens
    GROUP BY user_id,
      client_id
  ) AS f
WHERE f.user_id = t.user_id
  AND f.client_id = t.client_id;
ALTER TABLE oauth_refresh_tokens
ALTER COLUMN family_id
SET DEFAULT uuid_generate_v4(),
  ALTER COLUMN family_id
SET NOT NULL;
CREATE INDEX oauth_refresh_tokens_family_id_idx ON oauth_refresh_tokens (family_id);
COMMENT ON COLUMN oauth_refresh_tokens.family_id IS 'The login this refresh token descends from: one per authorization-code or device-code redemption, inherited on rotation. Reuse detection and revoking a refresh token end only this family, so one login of a user does not end their others.';
ALTER TABLE oauth_access_tokens
ADD COLUMN refresh_token_family_id UUID;
UPDATE oauth_access_tokens AS a
SET refresh_token_family_id = (
    SELECT t.family_id
    FROM oauth_refresh_tokens AS t
    WHERE t.user_id = a.user_id
      AND t.client_id = a.client_id
    LIMIT 1
  )
WHERE a.user_id IS NOT NULL;
CREATE INDEX oauth_access_tokens_refresh_token_family_id_idx ON oauth_access_tokens (refresh_token_family_id)
WHERE refresh_token_family_id IS NOT NULL;
COMMENT ON COLUMN oauth_access_tokens.refresh_token_family_id IS 'The refresh-token family (oauth_refresh_tokens.family_id) this access token was issued with, so ending a family also ends its access tokens. NULL for an access token issued without a refresh token.';

CREATE TABLE course_model_solution_settings (
  course_id UUID PRIMARY KEY REFERENCES courses,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reveal_after_deadline BOOLEAN NOT NULL DEFAULT FALSE,
  reveal_at TIMESTAMP WITH TIME ZONE
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_model_solution_settings FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_model_solution_settings IS 'When a course shows its exercises'' model solutions to students who have neither solved the exercise nor used up its tries. A course without a row reveals them only to those students.';
COMMENT ON COLUMN course_model_solution_settings.course_id IS 'The course the settings are for.';
COMMENT ON COLUMN course_model_solution_settings.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_model_solution_settings.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_model_solution_settings.reveal_after_deadline IS 'Whether an exercise''s model solution is shown to every student once the exercise''s deadline (its own, else its chapter''s) has passed.';
COMMENT ON COLUMN course_model_solution_settings.reveal_at IS 'From when every exercise''s model solution is shown to every student. NULL for never.';

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

COMMENT ON COLUMN repository_exercises.archive_path IS 'File store path of the exercise''s archive. Each version gets a new path. Copies of a course share their source''s archives.';
COMMENT ON COLUMN repository_exercises.download_url IS 'The URL of the archive at archive_path.';
ALTER TABLE repository_exercises
ADD COLUMN details JSONB;
COMMENT ON COLUMN repository_exercises.details IS 'What the exercise service that prepared the repository reported about the exercise, such as its language. Opaque to the host, which passes it back to exercise services with the exercise. NULL until the next sync after the column was added.';
ALTER TABLE exercise_service_info
ADD COLUMN repository_preparation_endpoint_path TEXT;
COMMENT ON COLUMN exercise_service_info.repository_preparation_endpoint_path IS 'Where the service finds the exercises of a cloned exercise repository. Exercise repositories need exactly one service to declare it.';

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

COMMENT ON TABLE retired_repository_exercise_archives IS 'Repository exercise archives replaced by a sync or left behind by a removed exercise or repository. The object is removed from the file store once no live repository exercise has it and no live exercise task uses a removed one that has it.';
COMMENT ON COLUMN retired_repository_exercise_archives.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN retired_repository_exercise_archives.created_at IS 'Timestamp when the archive was retired.';
COMMENT ON COLUMN retired_repository_exercise_archives.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN retired_repository_exercise_archives.deleted_at IS 'Timestamp when the archive was removed from the file store. If null, it is still stored.';
COMMENT ON COLUMN retired_repository_exercise_archives.repository_id IS 'The repository whose sync or deletion retired the archive.';
COMMENT ON COLUMN retired_repository_exercise_archives.archive_path IS 'File store path of the archive.';
COMMENT ON COLUMN retired_repository_exercise_archives.download_url IS 'The URL of the archive.';

ALTER TABLE exercise_tasks
ADD COLUMN repository_exercise_id UUID REFERENCES repository_exercises(id),
  ADD COLUMN repository_exercise_checksum BYTEA;
UPDATE exercise_tasks AS et
SET repository_exercise_id = re.id,
  repository_exercise_checksum = re.checksum
FROM repository_exercises AS re
WHERE (et.private_spec -> 'repository_exercise' ->> 'id') = re.id::text;
CREATE INDEX exercise_tasks_repository_exercise_id_idx ON exercise_tasks (repository_exercise_id)
WHERE repository_exercise_id IS NOT NULL;
COMMENT ON COLUMN exercise_tasks.repository_exercise_id IS 'The repository exercise the exercise editor picked for this task. The host sends its current version to the exercise service with every spec and grading request, and a repository sync re-derives the task''s specs when it changes.';
COMMENT ON COLUMN exercise_tasks.repository_exercise_checksum IS 'The checksum of the repository exercise version the task''s public and model solution specs were derived from. A sync re-derives them when it differs from the repository exercise''s current checksum.';

CREATE INDEX exercise_task_gradings_pending_updated_at_idx ON exercise_task_gradings (updated_at)
WHERE grading_progress = 'pending'
  AND deleted_at IS NULL;
CREATE INDEX exercise_task_submissions_exercise_task_grading_id_idx ON exercise_task_submissions (exercise_task_grading_id)
WHERE deleted_at IS NULL;
