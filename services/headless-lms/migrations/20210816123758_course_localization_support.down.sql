-- Add down migration script here
ALTER TABLE chapters DROP COLUMN copied_from;
ALTER TABLE pages DROP COLUMN copied_from;
ALTER TABLE exercises DROP COLUMN copied_from;
COMMENT ON COLUMN exercises.chapter_id IS NULL;
ALTER TABLE exercise_tasks DROP COLUMN copied_from;
ALTER TABLE courses DROP COLUMN language_code,
  DROP COLUMN copied_from,
  DROP COLUMN language_version_of_course_id;
