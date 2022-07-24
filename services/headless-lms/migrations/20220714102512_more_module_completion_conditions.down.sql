-- Add down migration script here
ALTER TABLE courses DROP COLUMN base_module_completion_requires_n_submodule_completions;
ALTER TABLE course_module_completions DROP COLUMN prerequisite_modules_completed;
