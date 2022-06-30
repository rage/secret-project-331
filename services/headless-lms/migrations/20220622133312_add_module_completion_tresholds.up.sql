-- 1. Add completion columns to course modules
ALTER TABLE course_modules
ADD COLUMN automatic_completion BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN automatic_completion_number_of_exercises_attempted_treshold INTEGER,
  ADD COLUMN automatic_completion_number_of_points_treshold INTEGER,
  ADD CONSTRAINT course_module_automatic_completion_validity CHECK (
    automatic_completion <> (
      COALESCE(
        automatic_completion_number_of_exercises_attempted_treshold,
        automatic_completion_number_of_points_treshold
      ) IS NULL
    )
  );
COMMENT ON COLUMN course_modules.automatic_completion IS 'Whether or not automatic completion is enabled for this module.';
COMMENT ON COLUMN course_modules.automatic_completion_number_of_exercises_attempted_treshold IS 'If automatic completions are enabled, the amount of exercises that need to be attempted (submitted at least once) to be qualified for completion.';
COMMENT ON COLUMN course_modules.automatic_completion_number_of_points_treshold IS 'If automatic completions are enabled, the amount of points that need to be gained to be qualified for completion.';
-- 2. Add course instance id to completions
-- ASSUMES THERE'S NO COMPLETIONS YET
ALTER TABLE course_module_completions
ADD COLUMN course_instance_id UUID NOT NULL REFERENCES course_instances(id);
CREATE UNIQUE INDEX course_module_completion_uniqueness ON course_module_completions (course_module_id, course_instance_id, user_id)
WHERE deleted_at IS NULL;
COMMENT ON COLUMN course_module_completions.course_instance_id IS 'Instance that the completion was on.';
