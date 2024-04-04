CREATE TABLE exercise_list_of_suspected_cheaters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES course_module_completions,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_id UUID REFERENCES exercises NOT NULL ,
  duration INTEGER NOT NULL,
  points INTEGER NOT NULL,
  attempts INTEGER NOT NULL,
  status activity_progress NOT NULL DEFAULT 'initialized'
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON exercise_list_of_suspected_cheaters_exercise_list
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE suspected_cheaters_exercise_list IS 'This table stores data regarding the list of exercises pertaining to students that have been suspected of cheating in a course.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.student_id IS 'The id of the student being suspected.';
COMMENT ON COLUMN exercise_list_of_suspected_cheaters_exercise_list.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.exercise_id IS 'Exercise Id of an exercise completed by the suspected student.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.duration IS 'The duration a suspected student used in completing an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.points IS 'The points a suspected student received from completing an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.attempts IS 'The number of times a student attempt an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.status IS 'The status of an exercise.';

-- suspected_cheater_exercise_states
CREATE TYPE activity_progress AS ENUM (
  'initialized',
  'started',
  'in-progress',
  'submitted',
  'completed'
);

CREATE TABLE exercise_student_average (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id UUID NOT NULL REFERENCES exercise,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  average_duration INTEGER NOT NULL,
  average_points INTEGER NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON exercise_student_average
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE exercise_student_average IS 'This table stores data regarding the average in a specific course.';
COMMENT ON COLUMN exercise_student_average.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN exercise_student_average.exercise_id IS 'The exercise_id of the exercise.';
COMMENT ON COLUMN exercise_student_average.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN exercise_student_average.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN exercise_student_average.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN exercise_student_average.average_duration IS 'The average duration a all student used in completing an exercise.';
COMMENT ON COLUMN exercise_student_average.average_points IS 'The average points all student received from completing an exercise.';
