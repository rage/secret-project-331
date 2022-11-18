-- Revert course_exams changes
ALTER TABLE course_exams DROP created_at,
  DROP updated_at,
  DROP deleted_at;
-- Add down migration script here
ALTER TABLE course_modules DROP CONSTRAINT course_module_automatic_completion_validity,
  ADD CONSTRAINT course_module_automatic_completion_validity CHECK (
    automatic_completion <> (
      COALESCE(
        automatic_completion_number_of_exercises_attempted_treshold,
        automatic_completion_number_of_points_treshold
      ) IS NULL
    )
  ),
  DROP COLUMN automatic_completion_exam_points_treshold;
