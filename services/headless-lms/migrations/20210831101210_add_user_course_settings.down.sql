-- Resolve old 'current' values to course_instance_enrollments table.
ALTER TABLE course_instance_enrollments
ADD COLUMN current BOOLEAN;
COMMENT ON COLUMN course_instance_enrollments.current IS 'Whether this enrollment is the latest one. Only one enrollment can be current so that we can figure out which course instance the user is doing without having to delete old enrollments.';
UPDATE course_instance_enrollments
SET current = TRUE
WHERE (user_id, course_instance_id) IN (
    SELECT user_id,
      current_course_instance_id
    FROM user_course_settings
  );
-- Drop created table;
DROP TABLE user_course_settings;
-- Revert enforcements to course_instance_enrollments_pkey;
DROP INDEX courses_user_course_settings_key;
DROP INDEX course_instance_enrollments_user_course_settings_key;
