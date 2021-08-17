-- Add down migration script here
DROP TABLE user_course_settings;
ALTER TABLE courses DROP COLUMN locale,
  DROP COLUMN copied_from_course_id,
  DROP COLUMN language_version_of_course_id;
