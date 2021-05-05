-- Add down migration script here
ALTER TABLE submissions
  DROP COLUMN exercise_id,
  DROP COLUMN course_id,
  DROP COLUMN exercise_item_id,
  DROP COLUMN data_json,
  DROP COLUMN grading_id,
  DROP COLUMN metadata;


DROP TABLE regrading_submissions;
DROP TABLE regradings;
DROP TABLE gradings;
DROP TYPE grading_progress;
DROP TYPE user_points_update_strategy;
