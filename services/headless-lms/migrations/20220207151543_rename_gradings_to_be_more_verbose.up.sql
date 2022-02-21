-- Add up migration script here
ALTER TABLE gradings
  RENAME COLUMN submission_id TO exercise_task_submission_id;
ALTER TABLE gradings
  RENAME TO exercise_task_gradings;
ALTER TABLE regrading_submissions
  RENAME COLUMN submission_id TO exercise_task_submission_id;
ALTER TABLE regrading_submissions
  RENAME TO exercise_task_regrading_submissions;
ALTER TABLE exercise_task_submissions
  RENAME COLUMN grading_id TO exercise_task_grading_id;
