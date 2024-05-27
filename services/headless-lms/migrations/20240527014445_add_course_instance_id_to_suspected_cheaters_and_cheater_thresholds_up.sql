-- This migration adds the course_instance_id column to the suspected_cheaters and cheater_thresholds tables
-- and ensures that it references the id column in the course_instances table.
-- Add course_instance_id to suspected_cheaters table and set it to reference course_instances(id)
ALTER TABLE suspected_cheaters
ADD course_instance_id UUID NOT NULL REFERENCES course_instances(id);
-- UPDATE exercise_service_info
-- SET has_custom_view = FALSE;
-- Add course_instance_id to cheater_thresholds table and set it to reference course_instances(id)
ALTER TABLE cheater_thresholds
ADD course_instance_id UUID NOT NULL REFERENCES course_instances(id);
-- Create a unique index on the course_instance_id column in cheater_thresholds table
CREATE UNIQUE INDEX unique_course_instance_id ON cheater_thresholds (course_instance_id, id)
WHERE deleted_at IS NULL;
