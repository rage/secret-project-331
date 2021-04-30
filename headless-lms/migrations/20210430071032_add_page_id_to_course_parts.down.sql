-- Add down migration script here
ALTER TABLE course_parts
  DROP COLUMN page_id;
