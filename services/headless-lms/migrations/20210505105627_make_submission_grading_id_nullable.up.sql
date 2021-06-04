-- Add up migration script here
ALTER TABLE submissions
  ALTER COLUMN grading_id
  DROP NOT NULL;
