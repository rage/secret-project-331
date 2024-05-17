CREATE TABLE suspected_cheaters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users,
  course_instance_id UUID NOT NULL REFERENCES course_instances,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  total_duration_seconds INTEGER,
  total_points INTEGER NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON suspected_cheaters FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE suspected_cheaters IS 'Contains a student that are suspected of cheating because they meet the cheating requirement (i.e. score > threshold && duration > average_duration).';
COMMENT ON COLUMN suspected_cheaters.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN suspected_cheaters.user_id IS 'The user_id of the student being suspected.';
COMMENT ON COLUMN suspected_cheaters.course_instance_id IS 'The course_instance_id of the course the suspected cheater is enrolled in.';
COMMENT ON COLUMN suspected_cheaters.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN suspected_cheaters.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN suspected_cheaters.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN suspected_cheaters.total_duration_seconds IS 'The total duration the student spent completing the course.';
COMMENT ON COLUMN suspected_cheaters.total_points IS 'The total points earned by the student in the course.';
-- The cheater_thresholds table starts here.
CREATE TABLE cheater_thresholds (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_instance_id UUID NOT NULL REFERENCES course_instances,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  points INTEGER NOT NULL,
  duration_seconds INTEGER
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON cheater_thresholds FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE cheater_thresholds IS 'This table stores thresholds set by the instructor, representing the maximum score or duration a student can surpass before being suspected of cheating cheaters.';
COMMENT ON COLUMN cheater_thresholds.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN cheater_thresholds.course_instance_id IS 'The course_instance_id of the course.';
COMMENT ON COLUMN cheater_thresholds.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN cheater_thresholds.updated_at IS 'Timestamp when the record was updated.';
COMMENT ON COLUMN cheater_thresholds.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN cheater_thresholds.points IS 'The score threshold of the course.';
COMMENT ON COLUMN cheater_thresholds.duration_seconds IS 'The duration threshold of the course.';
