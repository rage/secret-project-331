-- Add up migration script here
CREATE TABLE course_prerequisites (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  course_id UUID NOT NULL REFERENCES courses,
  prerequisite VARCHAR(255) NOT NULL
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON course_prerequisites FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE course_prerequisites IS 'Prerequisites are preliminary knowledge that is assumed for the student to have for a course';
COMMENT ON COLUMN course_prerequisites.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN course_prerequisites.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN course_prerequisites.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN course_prerequisites.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN course_prerequisites.course_id IS 'A prerequisite belongs to a course.';
COMMENT ON COLUMN course_prerequisites.prerequisite IS 'The prerequisite for a course.';
