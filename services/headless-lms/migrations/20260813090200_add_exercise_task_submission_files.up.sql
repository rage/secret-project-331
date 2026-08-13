CREATE TABLE exercise_task_submission_files (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_task_submission_id UUID NOT NULL REFERENCES exercise_task_submissions,
  file_upload_id UUID NOT NULL REFERENCES file_uploads,
  order_number INTEGER NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_task_submission_files FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
CREATE INDEX idx_exercise_task_submission_files_submission ON exercise_task_submission_files (exercise_task_submission_id)
WHERE deleted_at IS NULL;
CREATE INDEX idx_exercise_task_submission_files_file ON exercise_task_submission_files (file_upload_id)
WHERE deleted_at IS NULL;

COMMENT ON TABLE exercise_task_submission_files IS 'Links a task submission to the files the client uploaded for it, so the host can serve a submission''s files back without interpreting the exercise service''s answer.';
COMMENT ON COLUMN exercise_task_submission_files.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_task_submission_files.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_task_submission_files.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_task_submission_files.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_task_submission_files.exercise_task_submission_id IS 'The task submission these files belong to.';
COMMENT ON COLUMN exercise_task_submission_files.file_upload_id IS 'The uploaded file.';
COMMENT ON COLUMN exercise_task_submission_files.order_number IS 'The order the client sent the files in, preserved so the exercise service sees them in a stable order.';
