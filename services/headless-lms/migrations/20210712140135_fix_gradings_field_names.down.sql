-- Add down migration script here
ALTER TABLE gradings RENAME COLUMN unscaled_score_maximum TO unscaled_max_points;
ALTER TABLE gradings RENAME COLUMN unscaled_score_given TO unscaled_score_maximum;
