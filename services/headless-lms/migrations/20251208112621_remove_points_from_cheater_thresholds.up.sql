-- Drop points column
ALTER TABLE cheater_thresholds DROP COLUMN points;

-- Make duration_seconds NOT NULL
ALTER TABLE cheater_thresholds
ALTER COLUMN duration_seconds
SET NOT NULL;
COMMENT ON COLUMN cheater_thresholds.duration_seconds IS 'The duration threshold in seconds. For the default course module (where name IS NULL), this represents the time from the start of the course until the completion of the course. For additional modules, this represents the time from the completion of the base module until the completion of the additional module.';

-- Add course_module_id column (temporarily nullable for backfill)
ALTER TABLE cheater_thresholds
ADD COLUMN course_module_id UUID REFERENCES course_modules(id);
COMMENT ON COLUMN cheater_thresholds.course_module_id IS 'The course module this threshold applies to.';

-- Backfill course_module_id from course_id by finding the default course module (name IS NULL)
-- Only update rows where a default module exists
UPDATE cheater_thresholds ct
SET course_module_id = cm.id
FROM course_modules cm
WHERE ct.course_id = cm.course_id
  AND cm.name IS NULL
  AND cm.deleted_at IS NULL;

-- Delete any thresholds for courses that don't have a default module
-- (This should be rare, but we need to handle it)
DELETE FROM cheater_thresholds
WHERE course_module_id IS NULL;

-- Drop the old unique constraint on course_id (this will also drop the index)
ALTER TABLE cheater_thresholds DROP CONSTRAINT IF EXISTS unique_course_id_constraint;

-- Drop course_id column
ALTER TABLE cheater_thresholds DROP COLUMN course_id;

-- Make course_module_id NOT NULL
ALTER TABLE cheater_thresholds
ALTER COLUMN course_module_id
SET NOT NULL;

-- Create unique constraint on course_module_id
CREATE UNIQUE INDEX unique_course_module_id ON cheater_thresholds (course_module_id);
ALTER TABLE cheater_thresholds
ADD CONSTRAINT unique_course_module_id_constraint UNIQUE USING INDEX unique_course_module_id;
