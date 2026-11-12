CREATE TYPE exercise_answer_snapshot_purpose AS ENUM ('paste', 'backup');
COMMENT ON TYPE exercise_answer_snapshot_purpose IS 'Why a student stored an ungraded copy of an answer: to share it (paste) or to keep it before discarding local changes (backup).';

CREATE TABLE exercise_answer_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  exercise_slide_id UUID NOT NULL REFERENCES exercise_slides(id),
  exercise_task_id UUID NOT NULL REFERENCES exercise_tasks(id),
  purpose exercise_answer_snapshot_purpose NOT NULL,
  data_json JSONB
);

CREATE INDEX idx_exercise_answer_snapshots_user_exercise ON exercise_answer_snapshots (user_id, exercise_id, created_at)
WHERE deleted_at IS NULL;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_answer_snapshots FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE exercise_answer_snapshots IS 'Ungraded copies of a student''s answer stored through the exercise-services client API. Kept apart from exercise_slide_submissions so that nothing that grades, counts tries, awards points, picks peer reviews or computes completion can see them.';
COMMENT ON COLUMN exercise_answer_snapshots.id IS 'A unique, stable identifier for the record. Random like exercise slide submission ids, which lets the client API take either kind of id on the same routes.';
COMMENT ON COLUMN exercise_answer_snapshots.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_answer_snapshots.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_answer_snapshots.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Backups beyond the per-exercise cap are deleted oldest first.';
COMMENT ON COLUMN exercise_answer_snapshots.user_id IS 'The student whose answer this is.';
COMMENT ON COLUMN exercise_answer_snapshots.course_id IS 'The course the exercise belongs to. Not null because exam exercises cannot have snapshots.';
COMMENT ON COLUMN exercise_answer_snapshots.exercise_id IS 'The exercise the answer is for.';
COMMENT ON COLUMN exercise_answer_snapshots.exercise_slide_id IS 'The slide the answer is for.';
COMMENT ON COLUMN exercise_answer_snapshots.exercise_task_id IS 'The task the answer is for.';
COMMENT ON COLUMN exercise_answer_snapshots.purpose IS 'Why the snapshot was stored.';
COMMENT ON COLUMN exercise_answer_snapshots.data_json IS 'The exercise service''s own JSON about the answer''s files, opaque to the host. Null when the files are the whole answer.';

CREATE TABLE exercise_answer_snapshot_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_answer_snapshot_id UUID NOT NULL REFERENCES exercise_answer_snapshots(id),
  file_upload_id UUID NOT NULL REFERENCES file_uploads(id),
  order_number INTEGER NOT NULL
);

CREATE INDEX idx_exercise_answer_snapshot_files_snapshot ON exercise_answer_snapshot_files (exercise_answer_snapshot_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_exercise_answer_snapshot_files_file ON exercise_answer_snapshot_files (file_upload_id)
WHERE deleted_at IS NULL;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_answer_snapshot_files FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE exercise_answer_snapshot_files IS 'The uploaded files a snapshot consists of. The answer-upload reaper spares any upload a live row here references.';
COMMENT ON COLUMN exercise_answer_snapshot_files.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_answer_snapshot_files.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_answer_snapshot_files.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_answer_snapshot_files.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_answer_snapshot_files.exercise_answer_snapshot_id IS 'The snapshot these files belong to.';
COMMENT ON COLUMN exercise_answer_snapshot_files.file_upload_id IS 'The uploaded file.';
COMMENT ON COLUMN exercise_answer_snapshot_files.order_number IS 'The order the client named the files in.';

ALTER TABLE exercise_slide_submission_shares
ALTER COLUMN exercise_slide_submission_id DROP NOT NULL,
  ADD COLUMN exercise_answer_snapshot_id UUID REFERENCES exercise_answer_snapshots(id),
  ADD CONSTRAINT exercise_slide_submission_shares_one_target CHECK (
    num_nonnulls(exercise_slide_submission_id, exercise_answer_snapshot_id) = 1
  );

CREATE INDEX idx_exercise_slide_submission_shares_snapshot_id ON exercise_slide_submission_shares (exercise_answer_snapshot_id);

COMMENT ON COLUMN exercise_slide_submission_shares.exercise_slide_submission_id IS 'The submission this share links to. Null when the share links to a snapshot instead.';
COMMENT ON COLUMN exercise_slide_submission_shares.exercise_answer_snapshot_id IS 'The ungraded snapshot this share links to. Null when the share links to a submission instead.';

CREATE TABLE exercise_repository_ssh_host_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  host TEXT NOT NULL,
  port INTEGER NOT NULL,
  sha256_fingerprint TEXT NOT NULL,
  CONSTRAINT exercise_repository_ssh_host_keys_host_is_lowercase CHECK (host = lower(host)),
  CONSTRAINT exercise_repository_ssh_host_keys_port_range CHECK (
    port BETWEEN 1 AND 65535
  )
);

CREATE UNIQUE INDEX idx_exercise_repository_ssh_host_keys_host_port ON exercise_repository_ssh_host_keys (host, port, deleted_at) NULLS NOT DISTINCT;

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_repository_ssh_host_keys FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE exercise_repository_ssh_host_keys IS 'The ssh host key first seen when cloning an exercise repository from a git server whose key is not built into the application (trust on first use). A later clone from that server must present the same key. Kept per server rather than per repository because the key belongs to the server: one remembered key protects every repository on it.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.created_at IS 'Timestamp when the key was first seen.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Deleting the row is how an administrator accepts a server''s legitimately changed key: the next clone remembers the new one.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.host IS 'The git server''s host name as written in the clone URL, lowercased.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.port IS 'The ssh port the clone connected to.';
COMMENT ON COLUMN exercise_repository_ssh_host_keys.sha256_fingerprint IS 'The host key''s SHA-256 fingerprint, base64 without padding, as ssh-keygen -lf prints it after SHA256:.';
