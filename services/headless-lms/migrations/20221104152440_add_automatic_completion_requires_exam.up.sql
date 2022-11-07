-- Add up migration script here
ALTER TABLE course_modules
ADD automatic_completion_exam_points_treshold INTEGER,
  DROP CONSTRAINT course_module_automatic_completion_validity,
  ADD CONSTRAINT course_module_automatic_completion_validity CHECK (
    automatic_completion <> (
      COALESCE(
        automatic_completion_number_of_exercises_attempted_treshold,
        automatic_completion_number_of_points_treshold,
        automatic_completion_exam_points_treshold
      ) IS NULL
    )
  );
COMMENT ON COLUMN course_modules.automatic_completion_exam_points_treshold IS 'If not null, the amount of points required from an exam that is associated with the course module.';
