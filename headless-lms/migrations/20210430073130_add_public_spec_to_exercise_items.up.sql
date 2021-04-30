-- Add up migration script here
ALTER TABLE exercise_items
  ADD public_spec JSONB;

ALTER TABLE exercise_items
RENAME COLUMN spec TO private_spec;
