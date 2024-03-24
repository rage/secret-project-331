CREATE TABLE suspected_cheaters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES course_module_completion,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  total_duration VARCHAR(32) NOT NULL,
  student_average_duration VARCHAR(32) NOT NULL,
  total_points VARCHAR(32) NOT NULL student_average_points VARCHAR(32) NOT NULL
);
COMMENT ON TABLE suspected_cheaters IS 'This table stores data regarding student that are suspected of cheating in a course.';
COMMENT ON COLUMN suspected_cheaters.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN suspected_cheaters.student_id IS 'The id of the student being suspected.';
COMMENT ON COLUMN suspected_cheaters.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN suspected_cheaters.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN suspected_cheaters.total_duration IS 'The total duration the student spend completing the course.';
COMMENT ON COLUMN suspected_cheaters.student_average_duration IS 'The average total duration other student spent completing the course.';
COMMENT ON COLUMN suspected_cheaters.total_points IS 'The total points the student acquired in the course.';
COMMENT ON COLUMN suspected_cheaters.student_average_points IS 'The average total points other students acquired in the course.';
