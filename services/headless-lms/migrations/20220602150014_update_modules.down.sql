-- Add down migration script here
ALTER TABLE chapters
ALTER COLUMN course_module_id DROP NOT NULL;
ALTER TABLE chapters
  RENAME COLUMN course_module_id to module;
