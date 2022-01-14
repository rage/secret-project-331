-- Add down migration script here
ALTER TABLE exercise_task_submissions
  RENAME TO submissions;
