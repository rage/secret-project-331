-- Add up migration script here
ALTER TABLE course_modules
ADD COLUMN completion_registration_link_override VARCHAR(255);
COMMENT ON COLUMN course_modules.completion_registration_link_override IS 'If not null, use this link rather than the default one when registering course completions.';
