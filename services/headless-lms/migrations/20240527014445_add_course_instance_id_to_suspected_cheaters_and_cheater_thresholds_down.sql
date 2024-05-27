ALTER TABLE suspected_cheaters DROP course_instance_id;
ALTER TABLE cheater_thresholds DROP course_instance_id;
DROP INDEX nique_course_instance_id;
