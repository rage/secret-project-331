-- Add down migration script here
DROP INDEX course_module_automatic_completion_uniqueness;
ALTER TABLE course_module_completions DROP COLUMN completion_granter_user_id;
CREATE UNIQUE INDEX course_module_completion_uniqueness ON course_module_completions (course_module_id, course_instance_id, user_id)
WHERE deleted_at IS NULL;
