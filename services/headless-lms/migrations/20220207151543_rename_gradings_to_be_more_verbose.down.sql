-- Add down migration script here
ALTER TABLE exercise_task_gradings
  RENAME COLUMN exercise_task_submission_id TO submission_id;
ALTER TABLE exercise_task_gradings
  RENAME TO gradings;
ALTER TABLE exercise_task_regrading_submissions
  RENAME COLUMN exercise_task_submission_id TO submission_id;
ALTER TABLE exercise_task_regrading_submissions
  RENAME TO regrading_submissions;
ALTER TABLE exercise_task_submissions
  RENAME COLUMN exercise_task_grading_id TO grading_id;
