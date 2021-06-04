-- Add up migration script here
ALTER TABLE exercise_items
  ALTER COLUMN assignment SET DEFAULT '[]';
ALTER TABLE exercise_items
  ALTER COLUMN assignment SET NOT NULL;
