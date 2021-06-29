-- Add up migration script here
CREATE TABLE course_instance_enrollments (
  user_id UUID NOT NULL REFERENCES users,
  course_id UUID NOT NULL REFERENCES courses,
  course_instance_id UUID NOT NULL REFERENCES course_instances,
  current BOOL NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  PRIMARY KEY(user_id, course_instance_id)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_instance_enrollments FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
