ALTER TABLE suspected_cheaters DROP COLUMN IF EXISTS course_instance_id;
DROP INDEX IF EXISTS unique_course_instance_id;
----
ALTER TABLE course_module_completions DROP IF EXISTS need_to_be_reviewed;
