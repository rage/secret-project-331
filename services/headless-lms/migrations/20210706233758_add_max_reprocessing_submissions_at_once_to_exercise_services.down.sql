-- Add down migration script here
ALTER TABLE exercise_services DROP COLUMN max_reprocessing_submissions_at_once;
