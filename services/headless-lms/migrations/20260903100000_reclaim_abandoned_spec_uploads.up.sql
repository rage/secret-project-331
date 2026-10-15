CREATE TABLE exercise_spec_uploads (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  file_upload_id UUID NOT NULL REFERENCES file_uploads,
  exercise_service_slug VARCHAR(255) NOT NULL,
  uploaded_by_user UUID REFERENCES users
);
CREATE TYPE exercise_spec_kind AS ENUM ('private', 'public', 'model_solution');
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_spec_uploads FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE UNIQUE INDEX uq_exercise_spec_uploads_file_upload_id ON exercise_spec_uploads(file_upload_id, deleted_at) NULLS NOT DISTINCT;
CREATE INDEX idx_exercise_spec_uploads_created ON exercise_spec_uploads (created_at)
WHERE deleted_at IS NULL;

COMMENT ON TABLE exercise_spec_uploads IS 'Files uploaded through POST /api/v0/files/{exercise_service_slug}, the route a teacher''s CMS editor and the playground upload through. Membership here is what scopes the abandoned-spec-upload reaper: the reaper must never consider any other file_uploads row. file_uploads is shared with CMS media, organization images, certificates and answer files, none of which are recorded here, so a reaper widened to file_uploads would silently delete real user data. This narrow scope is a load-bearing safety property, not an optimization. Only uploads made after this table existed are recorded, so files uploaded earlier are never reaped -- the leak is closed going forward rather than retroactively.';
COMMENT ON COLUMN exercise_spec_uploads.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_spec_uploads.created_at IS 'Timestamp when the record was created. The reaper''s retention window is measured from this.';
COMMENT ON COLUMN exercise_spec_uploads.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_spec_uploads.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Set by the reaper when it retires the upload, which keeps the row as an audit trail of what was reclaimed.';
COMMENT ON COLUMN exercise_spec_uploads.file_upload_id IS 'The uploaded file.';
COMMENT ON COLUMN exercise_spec_uploads.exercise_service_slug IS 'The slug the file was uploaded under, kept for diagnosing what produced an abandoned upload. Not a foreign key: the playground uploads under the reserved slug "playground", which names no exercise service, and a service can be deleted without invalidating the record of its uploads.';
COMMENT ON COLUMN exercise_spec_uploads.uploaded_by_user IS 'The uploader, when the route authenticated one. Null for an upload authorized by an upload claim instead of a session.';

CREATE TABLE exercise_task_spec_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_task_id UUID NOT NULL REFERENCES exercise_tasks,
  file_upload_id UUID NOT NULL REFERENCES file_uploads,
  spec_kind exercise_spec_kind NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_task_spec_files FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_exercise_task_spec_files_file_upload ON exercise_task_spec_files (file_upload_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_exercise_task_spec_files_task ON exercise_task_spec_files (exercise_task_id, spec_kind)
WHERE deleted_at IS NULL;

COMMENT ON TABLE exercise_task_spec_files IS 'The files an exercise task''s specs reference, as the exercise service declared them: the private spec''s in the editor''s current-state message, each derived spec''s in the response of the endpoint that produced it. The host cannot read a spec blob, so this table is the only thing that tells it a stored file is still in use. Rewritten per task and spec kind whenever that spec is stored, so dropping a file from a spec soft-deletes its row here and eventually makes the upload reapable. The kinds must be tracked apart because a derived spec can name a file the private spec never did -- a service may upload during derivation through SpecRequest.upload_url, which is how tmc stores the template students download.';
COMMENT ON COLUMN exercise_task_spec_files.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_task_spec_files.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_task_spec_files.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_task_spec_files.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted. Set when a save drops the file from the spec.';
COMMENT ON COLUMN exercise_task_spec_files.exercise_task_id IS 'The task whose spec references the file.';
COMMENT ON COLUMN exercise_task_spec_files.spec_kind IS 'Which of the task''s three specs references the file.';
COMMENT ON COLUMN exercise_task_spec_files.file_upload_id IS 'The referenced file.';

CREATE TABLE page_history_spec_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  page_history_id UUID NOT NULL REFERENCES page_history,
  file_upload_id UUID NOT NULL REFERENCES file_uploads
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON page_history_spec_files FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_page_history_spec_files_file_upload ON page_history_spec_files (file_upload_id)
WHERE deleted_at IS NULL;

COMMENT ON TABLE page_history_spec_files IS 'The files each page-history version''s private specs reference. Only the private ones: restoring a version re-stores its private spec and the derived specs are produced from it again, so an old version''s derived files are never needed. Append-only, because history is: a restore must be able to bring back a version whose specs name these files, so a file stays out of the reaper''s reach for as long as any snapshot names it. The consequence is deliberate -- with history retained indefinitely, a file that ever reached a saved spec is effectively never reclaimed, and what the reaper collects is uploads that never made it into a save at all.';
COMMENT ON COLUMN page_history_spec_files.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN page_history_spec_files.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN page_history_spec_files.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN page_history_spec_files.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN page_history_spec_files.page_history_id IS 'The history version whose specs reference the file.';
COMMENT ON COLUMN page_history_spec_files.file_upload_id IS 'The referenced file.';

ALTER TABLE exercise_service_info
ADD COLUMN declares_spec_files BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN exercise_service_info.declares_spec_files IS 'Whether this service declares which stored files its specs reference -- the private spec''s in the editor''s current-state message, each derived spec''s in the response that produced it. Gates the abandoned-spec-upload reaper: a service that does not declare has none of its uploads reclaimed, because the host cannot read a spec and would be deleting files it has no evidence are unused. Opt-in for exactly that reason, and the flag is the whole safety property for services written before the declarations existed.';
