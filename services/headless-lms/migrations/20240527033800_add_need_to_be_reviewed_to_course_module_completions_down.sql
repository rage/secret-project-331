ALTER TABLE course_module_completions
ADD COLUMN needs_to_be_reviewed BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN course_module_completions.needs_to_be_reviewed IS 'Determine if a course module needs review as a result of a student being suspected of cheating';
-- Set value to all existing tables
UPDATE course_module_completions
SET needs_to_be_reviewed = false
WHERE needs_to_be_reviewed IS NULL;
