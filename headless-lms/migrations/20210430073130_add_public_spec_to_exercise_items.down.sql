-- Add down migration script here
ALTER TABLE exercise_items
  DROP COLUMN public_spec;

ALTER TABLE exercise_items
RENAME COLUMN private_spec TO spec;
