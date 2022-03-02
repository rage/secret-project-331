-- Create new exercise state tables
CREATE TABLE user_exercise_slide_states (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  user_exercise_state_id UUID NOT NULL REFERENCES user_exercise_states,
  exercise_slide_id UUID NOT NULL REFERENCES exercise_tasks,
  score_given real,
  grading_progress grading_progress NOT NULL DEFAULT 'not-ready',
  activity_progress activity_progress NOT NULL DEFAULT 'initialized'
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_exercise_slide_states FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_exercise_slide_states IS 'TODO';
COMMENT ON COLUMN user_exercise_slide_states.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_exercise_slide_states.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_exercise_slide_states.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_exercise_slide_states.user_exercise_state_id IS 'TODO';
COMMENT ON COLUMN user_exercise_slide_states.exercise_slide_id IS 'TODO';
COMMENT ON COLUMN user_exercise_slide_states.score_given IS 'TODO';
COMMENT ON COLUMN user_exercise_slide_states.grading_progress IS 'TODO';
COMMENT ON COLUMN user_exercise_slide_states.activity_progress IS 'TODO';
CREATE TABLE user_exercise_task_states (
  user_exercise_slide_state_id UUID NOT NULL REFERENCES user_exercise_slide_states,
  exercise_task_id UUID NOT NULL REFERENCES exercise_tasks,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  score_given real,
  grading_progress grading_progress NOT NULL DEFAULT 'not-ready',
  activity_progress activity_progress NOT NULL DEFAULT 'initialized',
  PRIMARY KEY (user_exercise_slide_state_id, exercise_task_id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_exercise_task_states FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_exercise_task_states IS 'TODO';
COMMENT ON COLUMN user_exercise_task_states.user_exercise_slide_state_id IS 'TODO';
COMMENT ON COLUMN user_exercise_task_states.exercise_task_id IS 'TODO';
COMMENT ON COLUMN user_exercise_task_states.score_given IS 'TODO';
COMMENT ON COLUMN user_exercise_task_states.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_exercise_task_states.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_exercise_task_states.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN user_exercise_task_states.score_given IS 'TODO';
COMMENT ON COLUMN user_exercise_task_states.grading_progress IS 'TODO';
COMMENT ON COLUMN user_exercise_task_states.activity_progress IS 'TODO';
