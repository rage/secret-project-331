ALTER TABLE courses
ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE courses
ADD COLUMN new_course_id UUID;
ALTER TABLE courses
ADD COLUMN closed_course_additional_message TEXT;

ALTER TABLE courses
ADD CONSTRAINT new_course_id_requires_closed_at CHECK (
    (new_course_id IS NULL)
    OR (closed_at IS NOT NULL)
  );

COMMENT ON COLUMN courses.closed_at IS 'The date and time the course was closed. If the course is not closed, this column is NULL. If the timestamp is in the future, the course will be closed at that time.';
COMMENT ON COLUMN courses.new_course_id IS 'The ID of the new course that the students can take instead of the closed course. If the course is not closed, this column needs to be NULL.';
COMMENT ON COLUMN courses.closed_course_additional_message IS 'An additional message to display to students on the closed course.';
