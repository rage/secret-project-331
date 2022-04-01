-- Create new exercise state tables
CREATE TABLE user_exercise_slide_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  user_exercise_state_id UUID NOT NULL REFERENCES user_exercise_states,
  exercise_slide_id UUID NOT NULL REFERENCES exercise_slides,
  score_given real,
  grading_progress grading_progress NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_exercise_slide_states FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_exercise_slide_states IS 'Part of user a exercise state, keeps track of the state of a single exercise slide.';
COMMENT ON COLUMN user_exercise_slide_states.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_exercise_slide_states.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_exercise_slide_states.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_exercise_slide_states.user_exercise_state_id IS 'User exercise state related to this user slide state.';
COMMENT ON COLUMN user_exercise_slide_states.exercise_slide_id IS 'Exercise slide that this state is tracking per exercise state.';
COMMENT ON COLUMN user_exercise_slide_states.score_given IS 'If not null, it indicates how many points the student has gotten from this exercise slide.';
COMMENT ON COLUMN user_exercise_slide_states.grading_progress IS 'Tells how grading of this exercise slide is progressing towards completion.';
CREATE UNIQUE INDEX user_exercise_slide_state_uniqueness ON user_exercise_slide_states (user_exercise_state_id, exercise_slide_id)
WHERE deleted_at IS NULL;
CREATE TABLE user_exercise_task_states (
  user_exercise_slide_state_id UUID NOT NULL REFERENCES user_exercise_slide_states,
  exercise_task_id UUID NOT NULL REFERENCES exercise_tasks,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  score_given real,
  grading_progress grading_progress NOT NULL,
  PRIMARY KEY (user_exercise_slide_state_id, exercise_task_id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_exercise_task_states FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_exercise_task_states IS 'Part of user a exercise state, keeps track of the state of a single exercise task.';
COMMENT ON COLUMN user_exercise_task_states.user_exercise_slide_state_id IS 'User exercise slide state related to this task state.';
COMMENT ON COLUMN user_exercise_task_states.exercise_task_id IS 'Exercise task that this task is tracking per exercise slide state.';
COMMENT ON COLUMN user_exercise_task_states.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_exercise_task_states.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_exercise_task_states.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_exercise_task_states.score_given IS 'If not null, it indicates how many points the student has gotten from this exercise slide.';
COMMENT ON COLUMN user_exercise_task_states.grading_progress IS 'Tells how grading of this exercise task is progressing towards completion.';
-- Move update strategy from task gradings to submissions and regradings
ALTER TABLE exercise_slide_submissions
ADD COLUMN user_points_update_strategy user_points_update_strategy NOT NULL DEFAULT 'can-add-points-but-cannot-remove-points';
UPDATE exercise_slide_submissions
SET user_points_update_strategy = 'can-add-points-and-can-remove-points'
WHERE exam_id IS NULL;
ALTER TABLE exercise_slide_submissions
ALTER COLUMN user_points_update_strategy DROP DEFAULT;
COMMENT ON COLUMN exercise_slide_submissions.user_points_update_strategy IS 'When we get results from a grading, how should we update the user''s points. See https://rage.github.io/secret-project-331/headless_lms_actix/models/gradings/enum.UserPointsUpdateStrategy.html.';
ALTER TABLE regradings
ADD COLUMN user_points_update_strategy user_points_update_strategy NOT NULL DEFAULT 'can-add-points-but-cannot-remove-points';
COMMENT ON COLUMN regradings.user_points_update_strategy IS 'When we get results from a grading, how should we update the user''s points. See https://rage.github.io/secret-project-331/headless_lms_actix/models/gradings/enum.UserPointsUpdateStrategy.html.';
ALTER TABLE regradings
ALTER COLUMN user_points_update_strategy DROP DEFAULT;
ALTER TABLE exercise_task_gradings DROP COLUMN user_points_update_strategy;
