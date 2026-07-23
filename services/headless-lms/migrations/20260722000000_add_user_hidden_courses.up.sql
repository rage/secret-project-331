-- Lets a signed-in user hide a course from their "My courses" list on the front page without
-- affecting their progress on that course. The course becomes visible again when the user next
-- visits its material (see get_course_page_by_path).
CREATE TABLE user_hidden_courses (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id),
  course_id UUID NOT NULL REFERENCES courses(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  deleted_at TIMESTAMP WITH TIME ZONE
);
CREATE UNIQUE INDEX user_hidden_courses_user_course_uniqueness ON user_hidden_courses (user_id, course_id)
WHERE deleted_at IS NULL;
CREATE TRIGGER set_timestamp BEFORE
UPDATE ON user_hidden_courses FOR EACH ROW EXECUTE PROCEDURE trigger_set_timestamp();
COMMENT ON TABLE user_hidden_courses IS 'Records that a user has hidden a course from their personal "My courses" list. An active (non-deleted) row means the course is hidden for that user.';
COMMENT ON COLUMN user_hidden_courses.id IS 'A unique, stable identifier for the record.';
COMMENT ON COLUMN user_hidden_courses.user_id IS 'The user who hid the course.';
COMMENT ON COLUMN user_hidden_courses.course_id IS 'The course that is hidden from the user''s "My courses" list.';
COMMENT ON COLUMN user_hidden_courses.created_at IS 'Timestamp when the record was created.';
COMMENT ON COLUMN user_hidden_courses.updated_at IS 'Timestamp when the record was last updated. The field is updated automatically by the set_timestamp trigger.';
COMMENT ON COLUMN user_hidden_courses.deleted_at IS 'Timestamp when the record was deleted. If null, the record is not deleted and the course is hidden.';
