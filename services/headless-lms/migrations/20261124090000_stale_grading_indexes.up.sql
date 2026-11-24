CREATE INDEX exercise_task_gradings_pending_updated_at_idx ON exercise_task_gradings (updated_at)
WHERE grading_progress = 'pending'
  AND deleted_at IS NULL;
CREATE INDEX exercise_task_submissions_exercise_task_grading_id_idx ON exercise_task_submissions (exercise_task_grading_id)
WHERE deleted_at IS NULL;
