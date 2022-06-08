-- Add down migration script here
ALTER TABLE chapters DROP COLUMN module;
DROP TABLE course_modules;
