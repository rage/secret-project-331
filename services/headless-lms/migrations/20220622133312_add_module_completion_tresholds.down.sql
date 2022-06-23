-- Add down migration script here
ALTER TABLE course_modules DROP CONSTRAINT course_module_automatic_completion_validity,
  DROP COLUMN automatic_completion,
  DROP COLUMN automatic_completion_number_of_exercises_attempted_treshold,
  DROP COLUMN automatic_completion_number_of_points_treshold;
