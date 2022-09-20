-- Add down migration script here
CREATE UNIQUE INDEX course_module_completion_uniqueness ON course_module_completions (course_module_id, course_instance_id, user_id)
WHERE deleted_at IS NULL;
