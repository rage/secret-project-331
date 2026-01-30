-- Revert unique constraint
ALTER TABLE cheater_thresholds DROP CONSTRAINT unique_course_module_id_constraint;
DROP INDEX IF EXISTS unique_course_module_id;

-- Add course_id column back (temporarily nullable for backfill)
ALTER TABLE cheater_thresholds
ADD COLUMN course_id UUID REFERENCES courses(id);

-- Backfill course_id from course_module_id
UPDATE cheater_thresholds ct
SET course_id = cm.course_id
FROM course_modules cm
WHERE ct.course_module_id = cm.id;

-- Make course_id NOT NULL
ALTER TABLE cheater_thresholds
ALTER COLUMN course_id
SET NOT NULL;

-- Recreate unique constraint on course_id
CREATE UNIQUE INDEX unique_course_id ON cheater_thresholds (course_id);
ALTER TABLE cheater_thresholds
ADD CONSTRAINT unique_course_id_constraint UNIQUE USING INDEX unique_course_id;

-- Drop course_module_id column
ALTER TABLE cheater_thresholds DROP COLUMN course_module_id;

-- Revert duration_seconds to nullable
ALTER TABLE cheater_thresholds
ALTER COLUMN duration_seconds DROP NOT NULL;

-- Add points column back
ALTER TABLE cheater_thresholds
ADD COLUMN points INTEGER NOT NULL DEFAULT 0;
