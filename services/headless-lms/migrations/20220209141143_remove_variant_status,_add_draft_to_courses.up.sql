-- Add up migration script here
ALTER TABLE course_instances DROP variant_status;
DROP TYPE variant_status;
ALTER TABLE courses
ADD is_draft BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN courses.is_draft IS 'Marks whether the course is a draft or not. Draft courses are only visible to authorized users.';
