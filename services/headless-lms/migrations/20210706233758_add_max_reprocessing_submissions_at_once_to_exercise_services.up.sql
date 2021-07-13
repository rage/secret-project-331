-- Add up migration script here
ALTER TABLE exercise_services
ADD max_reprocessing_submissions_at_once INTEGER NOT NULL;
