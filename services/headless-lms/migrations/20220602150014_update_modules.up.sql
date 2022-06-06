-- Add up migration script here
-- Rename module foreign key to follow convention
ALTER TABLE chapters
  RENAME COLUMN module to course_module_id;
-- Make course_module_id column non-nullable. Seed missing data with defailt modules.
INSERT INTO course_modules (course_id, name, order_number)
SELECT DISTINCT chapters.course_id,
  'aaa',
  0
FROM chapters
WHERE course_module_id IS NULL
  AND deleted_at IS NULL;
UPDATE chapters
SET course_module_id = course_modules.id
FROM course_modules
WHERE chapters.course_id = course_modules.course_id
  AND chapters.course_module_id IS NULL;
ALTER TABLE chapters
ALTER COLUMN course_module_id
SET NOT NULL;
