CREATE TABLE suspected_cheaters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users,
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
COMMENT ON COLUMN suspected_cheaters.user_id IS 'The user_id of the student being suspected.';
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
  average_duration INTEGER NOT NULL,
  average_points INTEGER NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON course_student_average
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE course_student_average IS 'This table stores data regarding the average in a specific course.';
COMMENT ON COLUMN course_student_average.course_id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_student_average.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_student_average.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN course_student_average.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_student_average.average_duration IS 'The average duration all student spent completing the course.';
COMMENT ON COLUMN course_student_average.average_points IS 'The average points all students acquired in the course.';

--

CREATE TABLE suspected_cheaters_exercise_list (
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
BEFORE UPDATE ON suspected_cheaters_exercise_list
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE suspected_cheaters_exercise_list IS 'This table stores data regarding the list of exercises pertaining to students that have been suspected of cheating in a course.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.student_id IS 'The id of the student being suspected.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.exercise_id IS 'Exercise Id of an exercise completed by the suspected student.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.duration IS 'The duration a suspected student used in completing an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.points IS 'The points a suspected student received from completing an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.attempts IS 'The number of times a student attempt an exercise.';
COMMENT ON COLUMN suspected_cheaters_exercise_list.status IS 'The status of an exercise.';

CREATE TABLE exercise_student_average (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  exercise_id UUID NOT NULL REFERENCES exercises,
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

CREATE TABLE cheater_thresholds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  points INTEGER NOT NULL,
  duration INTEGER NOT NULL
);

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON cheater_thresholds
FOR EACH ROW
EXECUTE PROCEDURE trigger_set_timestamp();

COMMENT ON TABLE cheater_thresholds IS 'This table stores threshold for measuring cheaters.';
COMMENT ON COLUMN cheater_thresholds.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN cheater_thresholds.course_id IS 'The course_id of the course.';
COMMENT ON COLUMN cheater_thresholds.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN cheater_thresholds.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN cheater_thresholds.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN cheater_thresholds.points IS 'The score threshold of the course.';
COMMENT ON COLUMN cheater_thresholds.duration IS 'The duration threshold of the course.';


