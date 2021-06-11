-- course instances
CREATE TABLE course_instances (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses,
  starts_at TIMESTAMP WITH TIME ZONE,
  ends_at TIMESTAMP WITH TIME ZONE,
  name VARCHAR(255),
  description VARCHAR(255)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_instances FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_instances IS 'Allows teachers to use a course multiple times with different points, submissions, and enrollments.';
-- Every course needs to have an course instance, so let's add stubs for existing ones.
INSERT INTO course_instances (course_id)
SELECT id
FROM courses;
-- submissions are related to course_instances, add field and populate data
ALTER TABLE submissions
ADD COLUMN course_instance_id UUID REFERENCES course_instances;
UPDATE submissions
SET course_instance_id = mapping.course_instance_id
FROM (
    SELECT submissions.id as submission_id,
      course_instances.id as course_instance_id
    FROM submissions
      LEFT JOIN course_instances ON (
        submissions.course_id = course_instances.course_id
      )
  ) as mapping
WHERE submissions.id = mapping.submission_id;
ALTER TABLE submissions
ALTER COLUMN course_instance_id
SET NOT NULL;
-- user_exercise_states
CREATE TYPE activity_progress AS ENUM (
  'initialized',
  'started',
  'in-progress',
  'submitted',
  'completed'
);
CREATE TABLE user_exercise_states (
  user_id UUID NOT NULL REFERENCES users,
  exercise_id UUID NOT NULL REFERENCES exercises,
  course_instance_id UUID NOT NULL REFERENCES course_instances,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  score_given real,
  grading_progress grading_progress NOT NULL DEFAULT 'not-ready',
  activity_progress activity_progress NOT NULL DEFAULT 'initialized',
  PRIMARY KEY(user_id, exercise_id, course_instance_id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_exercise_states FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_exercise_states IS 'Keeps track of state related to a user and to an exercise. Each course instance run has their own entries in the table. It is the source of truth for activity status, points etc.';
