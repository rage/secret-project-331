CREATE TABLE suspected_cheaters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES course_module_completions,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  total_duration INTEGER NOT NULL,
  total_points INTEGER NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON suspected_cheaters
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE suspected_cheaters IS 'This table stores data regarding student that are suspected of cheating in a course.';
COMMENT ON COLUMN suspected_cheaters.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN suspected_cheaters.student_id IS 'The id of the student being suspected.';
COMMENT ON COLUMN suspected_cheaters.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN suspected_cheaters.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN suspected_cheaters.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN suspected_cheaters.total_duration IS 'The total duration the student spend completing the course.';
COMMENT ON COLUMN suspected_cheaters.total_points IS 'The total points the student acquired in the course.';

CREATE TABLE course_student_average (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_average_duration INTEGER NOT NULL,
  course_average_points INTEGER NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON course_student_average
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_student_average IS 'This table stores data regarding the average in a specific course.';
COMMENT ON COLUMN course_student_average.course_id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_student_average.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_student_average.updates_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN course_student_average.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_student_average.student_average_duration IS 'The average duration all student spent completing the course.';
COMMENT ON COLUMN course_student_average.student_average_points IS 'The average points all students acquired in the course.';
