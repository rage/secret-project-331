-- Revert course_exams changes
ALTER TABLE course_exams DROP created_at,
  DROP updated_at,
  DROP deleted_at;
-- Revert exam changes
ALTER TABLE exams DROP minimum_points_treshold;
-- Revert course_modules changes
ALTER TABLE course_modules DROP COLUMN automatic_completion_requires_exam;
