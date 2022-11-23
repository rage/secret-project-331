-- Revert course_exams changes
ALTER TABLE course_exams DROP created_at,
  DROP updated_at,
  DROP deleted_at;
-- Add down migration script here
ALTER TABLE course_modules DROP COLUMN automatic_completion_requires_exam;
