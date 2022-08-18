-- Add down migration script here
ALTER TABLE exercises DROP COLUMN use_course_default_peer_review_config;
ALTER TABLE peer_review_configs
  RENAME TO peer_reviews;
ALTER TABLE peer_review_questions
  RENAME COLUMN peer_review_config_id TO peer_review_id;
ALTER TABLE peer_review_submissions
  RENAME COLUMN peer_review_config_id TO peer_review_id;
