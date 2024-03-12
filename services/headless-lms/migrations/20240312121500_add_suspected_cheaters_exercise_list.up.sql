CREATE TABLE exercise_list_of_suspected_cheaters_exercise_list (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES course_module_completion,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  exercise_id UUID NOT NULL,
  duration VARCHAR(32) NOT NULL,
  student_average_duration VARCHAR(32) NOT NULL,
  points VARCHAR(32) NOT NULL,
  student_average_points VARCHAR(32) NOT NULL,
  attempts VARCHAR(32) NOT NULL,
  status TEXT NOT NULL
);
COMMENT ON TABLE suspected_cheaters_exercise_list IS 'This table stores data regarding the list of exercises pertaining to students that have been suspected of cheating in a course.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.student_id IS 'The id of the student being suspected.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.exercise_id IS 'Exercise Id of an exercise completed by the suspected student.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.duration IS 'The duration a suspected student used in completing an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.student_average_duration IS 'The average duration a other student used in completing an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.points IS 'The points a suspected student received from completing an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.student_average_points IS 'The average points other student received from completing an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.attempts IS 'The number of times a student attempt an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.status IS 'The status of an exercise.';
