ALTER TABLE course_module_completions
ALTER COLUMN needs_to_be_reviewed DROP NOT NULL,
  ALTER COLUMN needs_to_be_reviewed DROP DEFAULT;
