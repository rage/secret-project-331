-- Add up migration script here
ALTER TABLE course_instances DROP variant_status;
DROP TYPE variant_status;
ALTER TABLE courses
ADD is_draft BOOLEAN NOT NULL DEFAULT FALSE;
