CREATE TABLE exercise_reset_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reset_by UUID NOT NULL REFERENCES users(id),
  reset_for UUID NOT NULL REFERENCES users(id),
  exercise_id UUID NOT NULL REFERENCES exercises(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  reset_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TRIGGER set_timestamp BEFORE
UPDATE ON exercise_reset_logs FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE exercise_reset_logs IS 'Stores logs of exercise resets, tracking who reset which exercises for whom and when.';
COMMENT ON COLUMN exercise_reset_logs.id IS 'A unique identifier for the reset log entry.';
COMMENT ON COLUMN exercise_reset_logs.reset_by IS 'The user who performed the reset.';
COMMENT ON COLUMN exercise_reset_logs.reset_for IS 'The user whose exercises were reset.';
COMMENT ON COLUMN exercise_reset_logs.exercise_id IS 'The ID of the exercise that was reset.';
COMMENT ON COLUMN exercise_reset_logs.course_id IS 'The course for which the reset exercise belongs.';
COMMENT ON COLUMN exercise_reset_logs.reset_at IS 'Timestamp when the reset action was performed. Defaults to the current timestamp.';
COMMENT ON COLUMN exercise_reset_logs.created_at IS 'Timestamp when the reset log entry was created.';
COMMENT ON COLUMN exercise_reset_logs.updated_at IS 'Timestamp when the reset log entry was last updated. This field is automatically updated by the set_timestamp trigger.';
COMMENT ON COLUMN exercise_reset_logs.deleted_at IS 'Timestamp when the log entry was marked as deleted. If null, the log entry is active.';
