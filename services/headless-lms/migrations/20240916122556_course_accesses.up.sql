CREATE TABLE course_accesses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  course_instance_id UUID NOT NULL REFERENCES course_instances(id),
  user_id UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
COMMENT ON TABLE course_accesses IS 'This table is used to check if user has access to a course that is only joinable by a special code';
COMMENT ON COLUMN course_accesses.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_accesses.course_instance_id IS 'Course instance that the user has access to.';
COMMENT ON COLUMN course_accesses.user_id IS 'User who has the access to the course.';
COMMENT ON COLUMN course_accesses.created_at IS 'Timestamp of when the record was created';
COMMENT ON COLUMN course_accesses.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
