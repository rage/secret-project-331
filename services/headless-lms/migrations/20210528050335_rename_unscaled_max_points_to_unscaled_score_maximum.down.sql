-- Add down migration script here
ALTER TABLE gradings
  RENAME COLUMN unscaled_score_maximum TO unscaled_score_given;
