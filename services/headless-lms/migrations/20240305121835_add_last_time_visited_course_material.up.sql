CREATE TABLE last_time_visited_course_materials (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE,
  visit_time TIMESTAMP WITH TIME ZONE NOT NULL,
  course_id UUID NOT NULL REFERENCES courses(id),
  user_id UUID NOT NULL REFERENCES users(id),
  -- Make sure that a user can only have one last time visited for a course.
  CONSTRAINT last_time_visited_course_materials_course_user_uniqueness UNIQUE NULLS NOT DISTINCT (course_id, user_id, deleted_at)
);
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON last_time_visited_course_materials FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE last_time_visited_course_materials IS 'Tells the last time a user visited the material for a course.';
COMMENT ON COLUMN last_time_visited_course_materials.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN last_time_visited_course_materials.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN last_time_visited_course_materials.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN last_time_visited_course_materials.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted.';
COMMENT ON COLUMN last_time_visited_course_materials.visit_time IS 'The time when the user visited the material.';
COMMENT ON COLUMN last_time_visited_course_materials.course_id IS 'Tells which course material was visited.';
COMMENT ON COLUMN last_time_visited_course_materials.user_id IS 'Tells which user visited the course material.';
