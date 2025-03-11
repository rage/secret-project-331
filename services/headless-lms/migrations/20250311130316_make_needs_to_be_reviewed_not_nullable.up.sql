UPDATE course_module_completions
SET needs_to_be_reviewed = FALSE
WHERE needs_to_be_reviewed IS NULL;

ALTER TABLE course_module_completions
ALTER COLUMN needs_to_be_reviewed
SET NOT NULL;
