-- Add up migration script here
ALTER TABLE course_modules
ADD COLUMN ects_credits INTEGER;
COMMENT ON COLUMN course_modules.ects_credits IS 'The amount of ECTS credits that the student can earn by completing this course module.';
