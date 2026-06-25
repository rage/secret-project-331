-- Add up migration script here
ALTER TYPE application_task
ADD VALUE IF NOT EXISTS 'sisu-description-summary';

UPDATE course_modules
SET uh_course_code = NULL
WHERE TRIM(uh_course_code) = '';

ALTER TABLE course_modules
ADD CONSTRAINT uh_course_code_not_empty_string CHECK (TRIM(uh_course_code) <> '');
