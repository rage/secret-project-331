ALTER TABLE courses
ADD COLUMN closed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE courses
ADD COLUMN closed_additional_message TEXT;
ALTER TABLE courses
ADD COLUMN closed_course_successor_id UUID REFERENCES courses(id);

COMMENT ON COLUMN courses.closed_at IS 'If null, the course is open. If not null and the time is in the past, the course is closed. If not null and the time is in the future, the course is open but will be closed at the specified time.';
COMMENT ON COLUMN courses.closed_additional_message IS 'An additional message to be displayed to students when the course is closed.';
COMMENT ON COLUMN courses.closed_course_successor_id IS 'A course where students will be directed to after the course is closed.';
