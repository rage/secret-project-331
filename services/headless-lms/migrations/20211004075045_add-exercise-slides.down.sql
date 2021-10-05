-- Revert changes to exercise_tasks to the best of our ablity.
ALTER TABLE exercise_tasks
ADD COLUMN exercise_id UUID REFERENCES exercises(id);
UPDATE exercise_tasks t
SET exercise_id = s.exercise_id
FROM exercise_slides s
WHERE t.exercise_slide_id = s.id;
ALTER TABLE exercise_tasks
ALTER COLUMN exercise_id
SET NOT NULL,
  DROP COLUMN exercise_slide_id;
COMMENT ON COLUMN exercise_tasks.exercise_id IS 'Exercise where this task is an option.';
-- Drop new table.
DROP TABLE exercise_slides;
