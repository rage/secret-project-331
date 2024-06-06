-- This migration adds the course_instance_id column to the suspected_cheaters and cheater_thresholds tables
-- and ensures that it references the id column in the course_instances table.
-- Add course_instance_id to suspected_cheaters table and set it to reference course_instances(id)
ALTER TABLE suspected_cheaters
ADD course_instance_id UUID NOT NULL REFERENCES course_instances;
-- Create a unique index on the course_instance_id column in cheater_thresholds table
CREATE UNIQUE INDEX unique_course_instance_id ON cheater_thresholds (course_instance_id);
-- Add constraint
ALTER TABLE cheater_thresholds
ADD CONSTRAINT unique_instance_id UNIQUE USING INDEX unique_course_instance_id;
----
ALTER TABLE course_module_completions
ADD COLUMN needs_to_be_reviewed BOOLEAN NOT NULL DEFAULT FALSE;
COMMENT ON COLUMN course_module_completions.needs_to_be_reviewed IS 'Determine if a course module needs review as a result of a student being suspected of cheating';
-- Set value to all existing tables
UPDATE course_module_completions
SET needs_to_be_reviewed = false
WHERE needs_to_be_reviewed IS NULL;
