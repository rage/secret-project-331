-- Add up migration script here
ALTER TABLE gradings
  RENAME COLUMN unscaled_score_given TO unscaled_score_maximum;
