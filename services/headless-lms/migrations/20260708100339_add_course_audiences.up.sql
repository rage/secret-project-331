-- Add up migration script here
CREATE TABLE course_audiences (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses,
  audience VARCHAR(255) NOT NULL
);
COMMENT ON TABLE course_audiences IS 'The audience course is meant for';
COMMENT ON COLUMN course_audiences.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_audiences.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_audiences.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_audiences.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_audiences.course_id IS 'An audience belongs to a course.';
COMMENT ON COLUMN course_audiences.audience IS 'The audience type for a course.';
