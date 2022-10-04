-- Add up migration script here
DROP INDEX course_module_completion_uniqueness;
ALTER TABLE course_module_completions
ADD COLUMN completion_granter_user_id UUID REFERENCES users;
COMMENT ON COLUMN course_module_completions.completion_granter_user_id IS 'User who added this completion. Null if it was granted automatically.';
CREATE UNIQUE INDEX course_module_automatic_completion_uniqueness ON course_module_completions (course_module_id, course_instance_id, user_id)
WHERE completion_granter_user_id IS NULL
  AND deleted_at IS NULL;
