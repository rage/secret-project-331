-- Add down migration script here
-- Revert course module comments
COMMENT ON COLUMN course_modules.name IS 'The name of the module.';
COMMENT ON COLUMN course_modules.order_number IS 'Defines the order in which the modules are shown.';
-- Revert make chapters.module non nullable.
ALTER TABLE chapters
ALTER COLUMN course_module_id DROP NOT NULL;
-- Revert chapters.module references to default modules back to null
UPDATE chapters
SET course_module_id = NULL
FROM course_modules
WHERE chapters.course_module_id = course_modules.id
  AND course_modules.name IS NULL;
-- Delete default course modules
DELETE FROM course_modules
WHERE name IS NULL;
-- Rever constraint on chapter module references
ALTER TABLE chapters DROP CONSTRAINT chapters_course_modules_course_fkey;
-- Revert make course_modules.name constraints
DROP INDEX course_modules_courses_key;
ALTER TABLE course_modules DROP CONSTRAINT default_course_module_is_first_in_order;
DROP INDEX course_modules_order_number_uniqueness;
ALTER TABLE course_modules
ALTER COLUMN name
SET NOT NULL;
-- Remove copied_frm field
ALTER TABLE course_modules DROP COLUMN copied_from;
-- Remove added update trigger
DROP TRIGGER set_timestamp ON course_modules;
-- Revert rename chapters.module
ALTER TABLE chapters
  RENAME COLUMN course_module_id to module;
