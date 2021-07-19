-- Add up migration script here
CREATE UNIQUE INDEX course_instances_has_only_one_default_instance_per_course ON course_instances (course_id)
WHERE deleted_at IS NULL
  AND name IS NULL;
