-- Add up migration script here
ALTER TABLE chapters
ALTER COLUMN module
SET NOT NULL;
ALTER TABLE course_modules
ALTER COLUMN name
SET NOT NULL;
CREATE UNIQUE INDEX course_has_only_one_default_module ON course_modules (course_id)
WHERE deleted_at IS NULL
  AND name IS NULL;
COMMENT ON COLUMN course_modules.name IS 'The name of the module. A NULL name indicates the default course module.';
COMMENT ON COLUMN chapters.module IS 'The module the chapter is a part of.';
