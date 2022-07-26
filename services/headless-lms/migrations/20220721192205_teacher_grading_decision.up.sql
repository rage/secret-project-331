CREATE TYPE teacher_decision_type AS ENUM(
  'full-points',
  'zero-points',
  'custom-points',
  'suspected-plagiarism'
);
CREATE TABLE teacher_grading_decisions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_exercise_state_id UUID NOT NULL REFERENCES user_exercise_states(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  score_given real NOT NULL,
  teacher_decision teacher_decision_type NOT NULL,
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON teacher_grading_decisions FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE teacher_grading_decisions IS 'Keeps track of teacher decisions regarding answers with notice if is suspected of plagiarism. Detailed information on the answer can be found from user_exercise_state';
