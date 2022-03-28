-- Add up migration script here
ALTER TABLE courses
ADD is_test BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN courses.is_test IS 'Marks whether the course is in test mode. Test mode courses have a notification on each page in the material.';
