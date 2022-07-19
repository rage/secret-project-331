-- Add up migration script here
ALTER TABLE courses
ADD COLUMN base_module_completion_requires_n_submodule_completions INTEGER NOT NULL DEFAULT 0;
COMMENT ON COLUMN courses.base_module_completion_requires_n_submodule_completions IS 'For courses that use a modular structure, this is the amount of additional modules that need to be completed in addition to the base module before the student is able to receive any credit for the course.';
ALTER TABLE course_module_completions
ADD column prerequisite_modules_completed BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN course_module_completions.prerequisite_modules_completed IS 'Whether or not the student is able to receive credits for this completion. Completions are granted individually for each module, but the same course''s modules may depend on each other.';
