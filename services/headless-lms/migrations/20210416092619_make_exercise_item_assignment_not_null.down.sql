-- Add down migration script here
ALTER TABLE exercise_items
  ALTER COLUMN assignment DROP DEFAULT;
ALTER TABLE exercise_items
  ALTER COLUMN assignment DROP NOT NULL;
