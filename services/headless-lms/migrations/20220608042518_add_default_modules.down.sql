-- Add down migration script here
DROP INDEX course_has_only_one_default_module;
ALTER TABLE course_modules DROP COLUMN is_default;
ALTER TABLE chapters
ALTER COLUMN module DROP NOT NULL;
