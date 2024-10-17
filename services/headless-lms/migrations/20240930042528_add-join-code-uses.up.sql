CREATE TABLE join_code_uses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES courses(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);


CREATE TRIGGER set_timestamp BEFORE
UPDATE ON join_code_uses FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE join_code_uses IS 'This table is used to check if user has access to a course that is only joinable by a join code. The join code is located in courses table';
COMMENT ON COLUMN join_code_uses.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN join_code_uses.course_id IS 'Course that the user has access to.';
COMMENT ON COLUMN join_code_uses.user_id IS 'User who has the access to the course.';
COMMENT ON COLUMN join_code_uses.created_at IS 'Timestamp of when the record was created';
COMMENT ON COLUMN join_code_uses.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN join_code_uses.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';

ALTER TABLE courses
ADD COLUMN join_code varchar(1024),
  ADD COLUMN is_joinable_by_code_only BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN courses.join_code IS 'Regeneratable code that is used to join the course. If a user uses the code they will be added to join_code_uses -table to get access to the course';
COMMENT ON COLUMN courses.is_joinable_by_code_only IS 'Whether this course is only joinable by a join code that can be generated for a course instance'
