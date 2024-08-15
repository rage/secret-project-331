-- This migration adds the course_id column to the suspected_cheaters and cheater_thresholds tables
-- and ensures that it references the id column in the courses table.
-- Add course_id to suspected_cheaters table and set it to reference courses(id)
ALTER TABLE suspected_cheaters
ADD course_id UUID NOT NULL REFERENCES courses;
--Replace course_instance_id to course_id in cheater_thresholds
ALTER TABLE cheater_thresholds DROP course_instance_id,
  ADD course_id UUID NOT NULL REFERENCES courses;
-- Create a unique index on the course_id column in cheater_thresholds table
CREATE UNIQUE INDEX unique_course_id ON cheater_thresholds (course_id);
-- Add constraint
ALTER TABLE cheater_thresholds
ADD CONSTRAINT unique_course_id_constraint UNIQUE USING INDEX unique_course_id;
-- Add needs_to_be_reviewed column to course_module_completions table with default NULL
ALTER TABLE course_module_completions -- this is not breaking the db because of the default
ADD COLUMN needs_to_be_reviewed BOOLEAN DEFAULT NULL;
COMMENT ON COLUMN course_module_completions.needs_to_be_reviewed IS 'Determine if a course module needs review as a result of a student being suspected of cheating';
-- The is_archived field is set to FALSE when a teacher confirms that a student is suspected of cheating.
-- The is_archived field is TRUE when a student is wrongly accused of cheating.
ALTER TABLE suspected_cheaters
ADD is_archived BOOLEAN NOT NULL DEFAULT FALSE;
