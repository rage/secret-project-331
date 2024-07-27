-- Add down migration script here
ALTER TABLE course_modules DROP COLUMN IF EXISTS is_completion_requirement_by_chapter;
----
DROP TABLE chapter_completion_requirements;
