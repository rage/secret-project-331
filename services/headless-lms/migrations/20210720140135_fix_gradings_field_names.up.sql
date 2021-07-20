-- Add up migration script here
ALTER TABLE gradings RENAME COLUMN unscaled_score_maximum TO unscaled_score_given;
ALTER TABLE gradings RENAME COLUMN unscaled_max_points TO unscaled_score_maximum;