-- Revert changes to gradings, regradings and submissions.
ALTER TABLE exercise_slide_submissions DROP COLUMN IF EXISTS user_points_update_strategy;
ALTER TABLE regradings DROP COLUMN IF EXISTS user_points_update_strategy;
ALTER TABLE exercise_task_gradings
ADD COLUMN user_points_update_strategy user_points_update_strategy NOT NULL DEFAULT 'can-add-points-but-cannot-remove-points';
UPDATE exercise_task_gradings
SET user_points_update_strategy = 'can-add-points-and-can-remove-points'
WHERE exam_id IS NULL;
COMMENT ON COLUMN exercise_task_gradings.user_points_update_strategy IS 'When we get results from a grading, how should we update the user''s points. See https://rage.github.io/secret-project-331/headless_lms_actix/models/gradings/enum.UserPointsUpdateStrategy.html.';
-- Drop new tables
DROP TABLE IF EXISTS user_exercise_task_states;
DROP TABLE IF EXISTS user_exercise_slide_states;
