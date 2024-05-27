ALTER TABLE course_module_completions
ADD COLUMN needs_to_be_reviewed BOOLEAN NOT NULL DEFAULT FALSE;
