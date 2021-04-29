-- Add down migration script here
ALTER TABLE exercises
  DROP COLUMN score_maximum;
