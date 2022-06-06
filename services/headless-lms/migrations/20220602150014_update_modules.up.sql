-- Add up migration script here
-- Rename module foreign key to follow convention
ALTER TABLE chapters
  RENAME COLUMN module to course_module_id;
-- Make course_modules.name nullable. That in addition to order_number = 0 will mean the default module.
ALTER TABLE course_modules
ALTER COLUMN name DROP NOT NULL;
CREATE UNIQUE INDEX default_course_module_uniqueness ON course_modules (course_id)
WHERE name IS NULL
  AND deleted_at IS NULL;
ALTER TABLE course_modules
ADD CONSTRAINT default_course_module_is_first_in_order CHECK ((name IS NULL) = (order_number = 0));
-- Make course_module_id column non-nullable. Seed missing data with defailt modules.
INSERT INTO course_modules (course_id, order_number)
SELECT DISTINCT chapters.course_id,
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
-- Update course_module comments
COMMENT ON COLUMN course_modules.name IS 'The name of the module. Null in this field will mean that the module is the default for that course.';
COMMENT ON COLUMN course_modules.order_number IS 'Defines the order in which the modules are shown. The index 0 is reserved for the default module of the course.';
