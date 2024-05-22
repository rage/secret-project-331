CREATE TABLE rejected_exercise_slide_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  user_id UUID NOT NULL REFERENCES users(id),
  exercise_slide_id UUID NOT NULL REFERENCES exercise_slides(id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON rejected_exercise_slide_submissions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE rejected_exercise_slide_submissions IS 'If an exercise slide submission is rejected, the submission is stored here. Rejections happen usually when there is some bug in the exercise service. This data if used for diagnosing problems.';
COMMENT ON COLUMN rejected_exercise_slide_submissions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN rejected_exercise_slide_submissions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN rejected_exercise_slide_submissions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN rejected_exercise_slide_submissions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN rejected_exercise_slide_submissions.user_id IS 'The user who submitted the exercise';
COMMENT ON COLUMN rejected_exercise_slide_submissions.exercise_slide_id IS 'The exercise slide that was submitted';
CREATE TABLE rejected_exercise_task_submissions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  rejected_exercise_slide_submission_id UUID NOT NULL REFERENCES rejected_exercise_slide_submissions(id),
  data_json JSONB NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON rejected_exercise_task_submissions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE rejected_exercise_task_submissions IS 'If an exercise task submission is rejected, the submission is stored here. Rejections happen usually when there is some bug in the exercise service. This data if used for diagnosing problems.';
COMMENT ON COLUMN rejected_exercise_task_submissions.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN rejected_exercise_task_submissions.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN rejected_exercise_task_submissions.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN rejected_exercise_task_submissions.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN rejected_exercise_task_submissions.rejected_exercise_slide_submission_id IS 'The rejected exercise slide submission that this task submission is related to';
COMMENT ON COLUMN rejected_exercise_task_submissions.data_json IS 'The contents of the failed sumbission';
