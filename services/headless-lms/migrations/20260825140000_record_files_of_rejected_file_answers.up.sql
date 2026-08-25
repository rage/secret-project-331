CREATE TABLE rejected_exercise_task_submission_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  rejected_exercise_task_submission_id UUID NOT NULL REFERENCES rejected_exercise_task_submissions,
  file_upload_id UUID NOT NULL REFERENCES file_uploads,
  order_number INTEGER NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON rejected_exercise_task_submission_files FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_rejected_exercise_task_submission_files_submission ON rejected_exercise_task_submission_files (rejected_exercise_task_submission_id)
WHERE deleted_at IS NULL;

COMMENT ON TABLE rejected_exercise_task_submission_files IS 'The files a rejected file answer named. Deliberately not consulted by the exercise_answer_uploads reaper: a rejected submission is one the student still has to redo, so its uploads stay orphaned and the objects are deleted at the end of the retention window. What survives is the audit trail -- these rows plus the file_uploads and exercise_answer_uploads rows they point at, which are only ever soft-deleted, so a rejection can still be diagnosed down to the name, type and size of every file it named.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.rejected_exercise_task_submission_id IS 'The rejected task submission that named these files.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.file_upload_id IS 'The uploaded file. The stored object is usually gone by the time anyone reads this row.';
COMMENT ON COLUMN rejected_exercise_task_submission_files.order_number IS 'The order the client sent the files in, preserved because it is part of a file answer.';
