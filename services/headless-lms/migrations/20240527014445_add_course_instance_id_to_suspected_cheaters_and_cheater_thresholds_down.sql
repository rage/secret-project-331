ALTER TABLE suspected_cheaters DROP COLUMN IF EXISTS course_instance_id;
ALTER TABLE cheater_thresholds DROP COLUMN IF EXISTS course_instance_id;
DROP INDEX IF EXISTS unique_course_instance_id;
