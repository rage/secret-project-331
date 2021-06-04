-- Add down migration script here
ALTER TABLE submissions
  ALTER COLUMN grading_id
  SET NOT NULL;
