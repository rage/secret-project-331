ALTER TABLE suspected_cheaters DROP COLUMN IF EXISTS course_id;
DROP INDEX IF EXISTS unique_course_id;
----
ALTER TABLE course_module_completions DROP IF EXISTS needs_to_be_reviewed;
ALTER TABLE cheater_thresholds
ADD course_instance_id UUID NOT NULL REFERENCES course_instances,
  DROP course_id;
